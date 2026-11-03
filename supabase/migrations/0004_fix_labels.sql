-- plpgsql only qualifies parameters by function name, so local variables need an explicit block label.

create or replace function private.quote_order(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
<<quote_order>>
declare
  biz jsonb := (select value from public.settings where key = 'business');
  del jsonb := (select value from public.settings where key = 'delivery');
  mkt jsonb := (select value from public.settings where key = 'marketing');
  today date := private.dhaka_now()::date;
  phone text := private.normalize_phone(p->>'phone');
  area text := nullif(trim(p->>'area'), '');
  code text := nullif(upper(trim(p->>'coupon')), '');
  lines jsonb;
  problems jsonb;
  subtotal int;
  fee int := 0;
  discount int := 0;
  coupon_discount int := 0;
  credit int := 0;
  coupon_msg text;
  applied text;
  c public.coupons%rowtype;
  now_t time := private.dhaka_now()::time;
  open_now boolean;
begin
  with wanted as (
    select (e->>'option_id')::uuid as option_id, least(sum(greatest((e->>'qty')::int, 1)), 50)::int as qty
    from jsonb_array_elements(coalesce(p->'items', '[]')) e
    group by 1
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
        'option_id', o.id, 'item_id', m.id, 'name', m.name, 'label', o.label, 'qty', w.qty,
        'price', o.price, 'line', o.price * w.qty, 'photo', m.photos[1])
      order by m.sort_order, o.sort_order) filter (where m.available and m.sold_out_on is distinct from today), '[]'),
    coalesce(jsonb_agg(coalesce(m.name, 'An item') || ' is not available right now.') filter (where not coalesce(m.available and m.sold_out_on is distinct from today, false)), '[]'),
    coalesce(sum(o.price * w.qty) filter (where m.available and m.sold_out_on is distinct from today), 0)
  into lines, problems, subtotal
  from wanted w
  left join public.item_options o on o.id = w.option_id
  left join public.menu_items m on m.id = o.item_id;

  if area = 'Pickup' then
    discount := least(coalesce((del->>'pickup_discount')::int, 0), subtotal);
  elsif area is not null then
    select (a->>'fee')::int into fee from jsonb_array_elements(del->'areas') a where a->>'name' = area;
    if not found then
      problems := problems || to_jsonb('We only deliver to ' || (select string_agg(a->>'name', ' and ') from jsonb_array_elements(del->'areas') a) || '.');
      fee := 0;
    elsif subtotal > coalesce((del->>'free_over')::int, 2147483647) then
      fee := 0;
    end if;
  end if;

  if code is not null then
    select * into c from public.coupons where coupons.code = quote_order.code;
    if found then
      if not c.active or (c.expires_at is not null and c.expires_at < now())
         or (c.max_uses is not null and c.used >= c.max_uses)
         or (c.phone is not null and c.phone is distinct from phone)
         or (c.source = 'manual' and not coalesce((mkt->>'coupons')::boolean, false)) then
        coupon_msg := 'That code is not valid.';
      elsif subtotal < c.min_order then
        coupon_msg := 'This code needs an order of at least Tk ' || c.min_order || '.';
      else
        coupon_discount := case when c.kind = 'percent' then subtotal * c.value / 100 else c.value end;
        applied := code;
      end if;
    elsif coalesce((mkt#>>'{referral,enabled}')::boolean, false)
      and exists (select 1 from public.customers x where x.referral_code = code and x.phone is distinct from quote_order.phone) then
      if phone is null then
        coupon_msg := 'Enter your phone number to use this code.';
      elsif exists (select 1 from public.orders o where o.phone = quote_order.phone) then
        coupon_msg := 'Referral codes are for first orders only.';
      else
        coupon_discount := (mkt#>>'{referral,amount}')::int;
        applied := code;
      end if;
    else
      coupon_msg := 'That code is not valid.';
    end if;
  end if;

  if phone is not null and coalesce((mkt#>>'{referral,enabled}')::boolean, false) then
    select least(referral_credit, greatest(subtotal - discount - coupon_discount, 0)) into credit
    from public.customers x where x.phone = quote_order.phone;
    credit := coalesce(credit, 0);
  end if;

  discount := least(discount + coupon_discount + credit, subtotal);
  open_now := coalesce((biz->>'kitchen_open')::boolean, false)
    and now_t >= (biz->>'open')::time and now_t < (biz->>'close')::time;

  return jsonb_build_object(
    'lines', lines, 'problems', problems, 'subtotal', subtotal, 'discount', discount,
    'delivery_fee', fee, 'total', greatest(subtotal - discount + fee, 0),
    'coupon', applied, 'coupon_message', coupon_msg, 'referral_credit', credit,
    'open_now', open_now, 'slots', private.slots()
  );
end $$;

create or replace function public.place_order(p_secret text, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
<<place_order>>
declare
  q jsonb;
  mkt jsonb := (select value from public.settings where key = 'marketing');
  pay jsonb := (select value from public.settings where key = 'payments');
  phone text := private.normalize_phone(p->>'phone');
  name text := trim(coalesce(p->>'name', ''));
  area text := trim(coalesce(p->>'area', ''));
  address text := nullif(trim(coalesce(p->>'address', '')), '');
  note text := trim(coalesce(p->>'note', ''));
  payment text := coalesce(p->>'payment', 'cod');
  dt text := coalesce(p->>'delivery_time', 'ASAP');
  scheduled timestamptz;
  order_row public.orders%rowtype;
  cost int;
  applied text;
  bounce text;
  referrer text;
  order_count int;
  loyalty_option uuid;
  my_code text;
begin
  perform private.check_secret(p_secret);

  if char_length(name) not between 2 and 60 then return jsonb_build_object('error', 'Please enter your name.'); end if;
  if phone is null then return jsonb_build_object('error', 'Please enter a valid Bangladeshi mobile number.'); end if;
  if char_length(note) > 300 then return jsonb_build_object('error', 'Please keep the note short.'); end if;
  if area <> 'Pickup' and (address is null or char_length(address) not between 5 and 200) then
    return jsonb_build_object('error', 'Please enter your road and house number.');
  end if;
  if char_length(coalesce(address, '')) > 200 then return jsonb_build_object('error', 'Please shorten the address.'); end if;
  if payment not in ('cod', 'bkash') or (payment = 'bkash' and not coalesce((pay->>'bkash_enabled')::boolean, false)) then
    return jsonb_build_object('error', 'Please choose a payment method.');
  end if;
  if jsonb_array_length(coalesce(p->'items', '[]')) not between 1 and 40 then
    return jsonb_build_object('error', 'Your cart is empty.');
  end if;

  q := private.quote_order(p);
  if jsonb_array_length(q->'problems') > 0 then
    return jsonb_build_object('error', q->'problems'->>0, 'quote', q);
  end if;
  if area = '' then return jsonb_build_object('error', 'Please choose your area.'); end if;
  if jsonb_array_length(q->'lines') = 0 then return jsonb_build_object('error', 'Your cart is empty.'); end if;
  if nullif(p->>'coupon', '') is not null and q->>'coupon' is null then
    return jsonb_build_object('error', coalesce(q->>'coupon_message', 'That code is not valid.'), 'quote', q);
  end if;
  if (p->>'expected_total')::int is distinct from (q->>'total')::int then
    return jsonb_build_object('error', 'The price has changed. Please check your new total.', 'quote', q);
  end if;

  if dt = 'ASAP' then
    if not (q->>'open_now')::boolean then
      return jsonb_build_object('error', 'We are closed right now. Please choose a time.', 'quote', q);
    end if;
  else
    if not (q->'slots' @> to_jsonb(dt)) then
      return jsonb_build_object('error', 'That time is no longer available. Please choose another.', 'quote', q);
    end if;
    scheduled := dt::timestamptz;
  end if;

  select coalesce(sum(c.cost * (l->>'qty')::int), 0) into cost
  from jsonb_array_elements(q->'lines') l
  join public.option_costs c on c.option_id = (l->>'option_id')::uuid;

  applied := q->>'coupon';
  select count(*) + 1 into order_count from public.orders o where o.phone = place_order.phone and o.status <> 'cancelled';

  if applied is not null then
    if exists (select 1 from public.coupons c where c.code = applied) then
      update public.coupons c set used = used + 1
      where c.code = applied and (c.max_uses is null or c.used < c.max_uses);
      if not found then return jsonb_build_object('error', 'That code has just run out.', 'quote', q); end if;
    else
      referrer := (select x.phone from public.customers x where x.referral_code = applied);
    end if;
  end if;

  insert into public.orders (status, name, phone, area, address, scheduled_for, payment, note,
                             subtotal, discount, delivery_fee, total, cost_total, coupon_code)
  values ('new', name, phone, area, address, scheduled, payment, note,
          (q->>'subtotal')::int, (q->>'discount')::int, (q->>'delivery_fee')::int, (q->>'total')::int, cost, applied)
  returning * into order_row;

  insert into public.order_items (order_id, option_id, name, option_label, qty, unit_price, unit_cost)
  select order_row.id, (l->>'option_id')::uuid, l->>'name', l->>'label', (l->>'qty')::int, (l->>'price')::int,
         coalesce((select c.cost from public.option_costs c where c.option_id = (l->>'option_id')::uuid), 0)
  from jsonb_array_elements(q->'lines') l;

  -- free loyalty item goes on the order at Tk 0, so the kitchen sees it
  if coalesce((mkt#>>'{loyalty,enabled}')::boolean, false) and order_count % greatest((mkt#>>'{loyalty,every}')::int, 2) = 0 then
    loyalty_option := nullif(mkt#>>'{loyalty,option_id}', '')::uuid;
    insert into public.order_items (order_id, option_id, name, option_label, qty, unit_price, unit_cost)
    select order_row.id, o.id, m.name, trim(o.label || ' — loyalty gift'), 1, 0, coalesce(c.cost, 0)
    from public.item_options o join public.menu_items m on m.id = o.item_id
    left join public.option_costs c on c.option_id = o.id
    where o.id = loyalty_option;
    update public.orders o set cost_total = o.cost_total + coalesce((select c.cost from public.option_costs c where c.option_id = loyalty_option), 0)
    where o.id = order_row.id;
  end if;

  if coalesce((mkt#>>'{referral,enabled}')::boolean, false) then
    my_code := 'REF-' || upper(encode(extensions.gen_random_bytes(3), 'hex'));
    insert into public.customers (phone, referral_code) values (phone, my_code) on conflict on constraint customers_pkey do nothing;
    update public.customers x set referral_credit = greatest(referral_credit - (q->>'referral_credit')::int, 0) where x.phone = place_order.phone;
    if referrer is not null then
      update public.customers x set referral_credit = referral_credit + (mkt#>>'{referral,amount}')::int where x.phone = referrer;
    end if;
  end if;

  if coalesce((mkt#>>'{bounce,enabled}')::boolean, false) then
    bounce := 'BACK-' || upper(encode(extensions.gen_random_bytes(3), 'hex'));
    insert into public.coupons (code, kind, value, max_uses, expires_at, phone, source)
    values (bounce, 'amount', (mkt#>>'{bounce,amount}')::int, 1,
            now() + make_interval(days => (mkt#>>'{bounce,days}')::int), phone, 'bounce');
    update public.orders o set bounce_code = bounce where o.id = order_row.id;
  end if;

  return jsonb_build_object(
    'token', order_row.receipt_token, 'order_no', order_row.order_no,
    'lines', q->'lines', 'subtotal', order_row.subtotal, 'discount', order_row.discount,
    'delivery_fee', order_row.delivery_fee, 'total', order_row.total,
    'name', name, 'area', area, 'address', address, 'scheduled_for', scheduled,
    'payment', payment, 'note', note, 'phone', phone
  );
end $$;

create or replace function public.save_menu_item(p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
<<save_menu_item>>
declare
  item_id uuid := nullif(p->>'id', '')::uuid;
  keep uuid[] := '{}';
  o jsonb;
  opt_id uuid;
begin
  if jsonb_array_length(coalesce(p->'options', '[]')) = 0 then raise exception 'An item needs at least one price'; end if;
  if item_id is null then
    insert into public.menu_items (category_id, name, description, ingredients, allergens, badge, photos, available, suggest, sold_out_on, is_sample, sort_order)
    values ((p->>'category_id')::uuid, p->>'name', p->>'description', p->>'ingredients', p->>'allergens',
            nullif(p->>'badge', ''), array(select jsonb_array_elements_text(p->'photos')),
            (p->>'available')::boolean, (p->>'suggest')::boolean, (p->>'sold_out_on')::date, false,
            coalesce((select max(sort_order) + 1 from public.menu_items), 0))
    returning id into item_id;
  else
    update public.menu_items m set category_id = (p->>'category_id')::uuid, name = p->>'name', description = p->>'description',
      ingredients = p->>'ingredients', allergens = p->>'allergens', badge = nullif(p->>'badge', ''),
      photos = array(select jsonb_array_elements_text(p->'photos')),
      available = (p->>'available')::boolean, suggest = (p->>'suggest')::boolean, sold_out_on = (p->>'sold_out_on')::date,
      is_sample = false
    where m.id = item_id;
  end if;

  for o in select value from jsonb_array_elements(p->'options') with ordinality as t(value, n) order by n loop
    opt_id := nullif(o->>'id', '')::uuid;
    if opt_id is null then
      insert into public.item_options (item_id, label, price, sort_order)
      values (item_id, coalesce(o->>'label', ''), (o->>'price')::int, coalesce(array_length(keep, 1), 0))
      returning id into opt_id;
    else
      update public.item_options x set label = coalesce(o->>'label', ''), price = (o->>'price')::int,
        sort_order = coalesce(array_length(keep, 1), 0)
      where x.id = opt_id and x.item_id = save_menu_item.item_id;
    end if;
    insert into public.option_costs (option_id, cost) values (opt_id, coalesce((o->>'cost')::int, 0))
    on conflict on constraint option_costs_pkey do update set cost = excluded.cost;
    keep := keep || opt_id;
  end loop;
  delete from public.item_options x where x.item_id = save_menu_item.item_id and not (x.id = any (keep));
  return item_id;
end $$;
