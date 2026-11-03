-- Ordering, pricing and admin functions. Pricing lives here and only here:
-- the browser asks for a quote and displays it, and place_order recalculates it inside the transaction.

create function private.check_secret(p_secret text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex') is distinct from
     (select value from private.config where key = 'server_secret_sha256') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create function private.dhaka_now() returns timestamp
language sql stable set search_path = '' as $$ select now() at time zone 'Asia/Dhaka' $$;

create function private.normalize_phone(p text) returns text
language sql immutable set search_path = '' as $$
  select case when c ~ '^(88)?01[3-9][0-9]{8}$' then right(c, 11) end
  from (select regexp_replace(coalesce(p, ''), '[\s+()-]', '', 'g') as c) s
$$;

-- Half-hour slots from the next bookable moment to closing, today and tomorrow.
create function private.slots() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  biz jsonb := (select value from public.settings where key = 'business');
  now_d timestamp := private.dhaka_now();
  open_t time := (biz->>'open')::time;
  close_t time := (biz->>'close')::time;
  out_slots jsonb := '[]';
  d date;
  t timestamp;
begin
  if not coalesce((biz->>'kitchen_open')::boolean, false) then return out_slots; end if;
  foreach d in array array[now_d::date, now_d::date + 1] loop
    t := d + open_t + interval '30 minutes';
    while t <= d + close_t loop
      if t >= now_d + interval '30 minutes' then
        out_slots := out_slots || to_jsonb(to_char(t at time zone 'Asia/Dhaka' at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
      end if;
      t := t + interval '30 minutes';
    end loop;
  end loop;
  return out_slots;
end $$;

-- Works out every price. Input: {items:[{option_id,qty}], area, coupon, phone}.
create function private.quote_order(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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

create function public.get_quote(p_secret text, p jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.check_secret(p_secret);
  return private.quote_order(p);
end $$;

-- Input adds: name, address, delivery_time ('ASAP' or a slot), payment, note, expected_total.
create function public.place_order(p_secret text, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
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

-- Everything a receipt may show. Deliberately no phone and no address.
create function public.get_receipt(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  o public.orders%rowtype;
  mkt jsonb := (select value from public.settings where key = 'marketing');
  loyalty jsonb;
  ref text;
  n int;
begin
  select * into o from public.orders where receipt_token = p_token;
  if not found then return null; end if;

  if coalesce((mkt#>>'{loyalty,enabled}')::boolean, false) and o.phone is not null then
    select count(*) into n from public.orders x
    where x.phone = o.phone and x.status <> 'cancelled' and x.created_at <= o.created_at;
    loyalty := jsonb_build_object('every', (mkt#>>'{loyalty,every}')::int, 'count', n,
                                  'label', mkt#>>'{loyalty,label}');
  end if;
  if coalesce((mkt#>>'{referral,enabled}')::boolean, false) then
    ref := (select referral_code from public.customers c where c.phone = o.phone);
  end if;

  return jsonb_build_object(
    'order_no', o.order_no, 'created_at', o.created_at, 'status', o.status,
    'first_name', split_part(o.name, ' ', 1), 'area', o.area, 'note', o.note,
    'scheduled_for', o.scheduled_for, 'payment', o.payment,
    'subtotal', o.subtotal, 'discount', o.discount, 'delivery_fee', o.delivery_fee, 'total', o.total,
    'bounce_code', o.bounce_code,
    'bounce_days', mkt#>>'{bounce,days}', 'bounce_amount', mkt#>>'{bounce,amount}',
    'loyalty', loyalty, 'referral_code', ref, 'referral_amount', mkt#>>'{referral,amount}',
    'reviewed', exists (select 1 from public.reviews r where r.order_id = o.id),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', i.name, 'label', i.option_label, 'qty', i.qty, 'price', i.unit_price) order by i.name), '[]')
      from public.order_items i where i.order_id = o.id)
  );
end $$;

-- Reviews come only from a delivered order's private receipt link.
create function public.submit_review(p_secret text, p_token text, p_rating int, p_body text) returns text
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
  perform private.check_secret(p_secret);
  select * into o from public.orders where receipt_token = p_token;
  if not found or o.status <> 'delivered' then return 'Reviews open once your order is delivered.'; end if;
  if p_rating not between 1 and 5 or char_length(trim(p_body)) not between 3 and 600 then return 'Please add a rating and a few words.'; end if;
  insert into public.reviews (order_id, name, rating, body)
  values (o.id, split_part(o.name, ' ', 1), p_rating, trim(p_body))
  on conflict (order_id) do nothing;
  return null;
end $$;

create function public.hit_rate_limit(p_secret text, p_key text, p_max int, p_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare h int;
begin
  perform private.check_secret(p_secret);
  insert into private.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_seconds) then now() else r.window_start end
  returning hits into h;
  delete from private.rate_limits where window_start < now() - interval '1 day';
  return h <= p_max;
end $$;

-- STAFF --------------------------------------------------------------
create function public.set_order_status(p_id uuid, p_status public.order_status) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.orders o set
    status = p_status,
    confirmed_at = case when p_status = 'confirmed' then coalesce(o.confirmed_at, now()) else o.confirmed_at end,
    cooking_at = case when p_status = 'cooking' then coalesce(o.cooking_at, now()) else o.cooking_at end,
    out_at = case when p_status = 'out_for_delivery' then coalesce(o.out_at, now()) else o.out_at end,
    delivered_at = case when p_status = 'delivered' then coalesce(o.delivered_at, now()) else o.delivered_at end,
    cancelled_at = case when p_status = 'cancelled' then coalesce(o.cancelled_at, now()) else o.cancelled_at end
  where o.id = p_id;
end $$;

-- OWNER --------------------------------------------------------------
-- Runs as the caller so RLS applies and one save is one undoable transaction.
create function public.save_menu_item(p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
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

-- Replays one save backwards from the audit log. The undo is itself logged, so it can be undone too.
create function public.undo_change(p_audit_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  tx bigint;
  a public.audit_log%rowtype;
  pk text;
  cols text;
begin
  if not private.is_owner() then raise exception 'forbidden' using errcode = '42501'; end if;
  select txid into tx from public.audit_log where id = p_audit_id and not undone;
  if tx is null then raise exception 'Already undone'; end if;
  set constraints all deferred;
  for a in select * from public.audit_log where txid = tx and not undone order by id desc loop
    pk := case a.table_name when 'settings' then 'key' when 'pages' then 'slug' when 'coupons' then 'code'
                            when 'option_costs' then 'option_id' else 'id' end;
    if a.table_name not in ('categories','menu_items','item_options','option_costs','settings','pages','coupons','reviews') then
      raise exception 'Cannot undo this';
    end if;
    select string_agg(quote_ident(attname), ',') into cols
    from pg_catalog.pg_attribute where attrelid = ('public.' || quote_ident(a.table_name))::regclass and attnum > 0 and not attisdropped;
    if a.action = 'INSERT' then
      execute format('delete from public.%I where %I::text = $1', a.table_name, pk) using a.after->>pk;
    elsif a.action = 'UPDATE' then
      -- a real update, because delete + insert would cascade to child rows
      execute format('update public.%I set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where %I::text = $2',
                     a.table_name, cols, cols, a.table_name, pk) using a.before, a.before->>pk;
    else
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
                     a.table_name, cols, cols, a.table_name) using a.before;
    end if;
  end loop;
  update public.audit_log set undone = true where txid = tx;
end $$;

-- Erases a person: their orders stay for the sales numbers but lose every personal detail.
create function public.delete_customer(p_phone text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int; ph text := private.normalize_phone(p_phone);
begin
  if not private.is_owner() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.reviews r using public.orders o where r.order_id = o.id and o.phone = ph;
  update public.orders o set name = 'Deleted', phone = null, address = null, note = '' where o.phone = ph;
  get diagnostics n = row_count;
  delete from public.customers c where c.phone = ph;
  return n;
end $$;

create function public.dashboard_stats(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not private.is_owner() then raise exception 'forbidden' using errcode = '42501'; end if;
  with o as (
    select * from public.orders where created_at >= p_from and created_at < p_to and status <> 'cancelled'
  ), by_phone as (
    select phone, count(*) c,
      exists (select 1 from public.orders p where p.phone = o.phone and p.status <> 'cancelled' and p.created_at < min(o.created_at)) as before
    from o where phone is not null group by phone
  )
  select jsonb_build_object(
    'orders', (select count(*) from o),
    'sales', (select coalesce(sum(total), 0) from o),
    'avg_order', (select coalesce(round(avg(total)), 0) from o),
    'cost_pct', (select case when sum(total) > 0 then round(100.0 * sum(cost_total) / sum(total), 1) end from o),
    'cost_missing', (select count(*) from o where cost_total = 0),
    'profit_per_order', (select coalesce(round(avg(total - cost_total)), 0) from o),
    'repeat_pct', (select case when count(*) > 0 then round(100.0 * count(*) filter (where c > 1 or before) / count(*), 1) end from by_phone),
    'avg_delivery_min', (select round(avg(extract(epoch from delivered_at - created_at)) / 60) from o where delivered_at is not null and scheduled_for is null),
    'complaints_per_100', (select case when count(*) > 0 then round(100.0 * (select count(*) from public.complaints c join o x on x.id = c.order_id) / count(*), 1) end from o),
    'by_day', (select coalesce(jsonb_agg(d order by d->>'day'), '[]') from (
        select jsonb_build_object('day', (created_at at time zone 'Asia/Dhaka')::date, 'orders', count(*), 'sales', sum(total)) d
        from o group by (created_at at time zone 'Asia/Dhaka')::date) s),
    'top_items', (select coalesce(jsonb_agg(t order by (t->>'qty')::int desc), '[]') from (
        select jsonb_build_object('name', i.name, 'qty', sum(i.qty)) t
        from public.order_items i join o on o.id = i.order_id
        group by i.name order by sum(i.qty) desc limit 5) s),
    'by_area', (select coalesce(jsonb_agg(t order by (t->>'orders')::int desc), '[]') from (
        select jsonb_build_object('area', area, 'orders', count(*)) t from o group by area) s)
  ) into r;
  return r;
end $$;

-- Only the functions meant to be called over the API stay callable.
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function public.get_quote(text, jsonb), public.place_order(text, jsonb),
  public.get_receipt(text), public.submit_review(text, text, int, text),
  public.hit_rate_limit(text, text, int, int) to anon, authenticated;
grant execute on function public.set_order_status(uuid, public.order_status), public.save_menu_item(jsonb),
  public.undo_change(bigint), public.delete_customer(text), public.dashboard_stats(timestamptz, timestamptz) to authenticated;
grant execute on function private.my_role(), private.is_owner(), private.is_staff() to anon, authenticated;
