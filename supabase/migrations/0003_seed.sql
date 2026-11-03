-- Starter content. Every menu item is marked is_sample so the admin shows what still needs replacing.

insert into public.settings (key, value) values
('business', '{"phone":"01726-779404","whatsapp":"","facebook":"","area_label":"Lalmatia, Dhaka","open":"12:00","close":"22:00","kitchen_open":true}'),
('delivery', '{"areas":[{"name":"Mohammadpur","fee":30},{"name":"Dhanmondi","fee":50}],"free_over":500,"pickup_discount":20}'),
('payments', '{"bkash_enabled":false,"bkash_number":""}'),
('marketing', '{"coupons":false,"bounce":{"enabled":false,"amount":40,"days":7},"loyalty":{"enabled":false,"every":5,"option_id":"","label":"free strips"},"referral":{"enabled":false,"amount":30}}');

insert into public.pages (slug, content) values
('home', $json${
  "hero_title": "Fried fresh. Made properly.",
  "hero_sub": "Real chicken, a clean kitchen, and every piece fried when you order.",
  "hero_image": "",
  "promise": "Real photo, real portion.",
  "story_title": "A chef's kitchen, not a fast-food line",
  "story_text": "Chef Shaheen Islam trained at the Professional Cooking Academy, Dhaka, and cooks every order from our kitchen in Lalmatia.",
  "steps": [
    {"title": "Choose", "text": "Pick your chicken from the menu and add it to your cart."},
    {"title": "Confirm", "text": "Add your details, get your receipt, and confirm on WhatsApp."},
    {"title": "Enjoy", "text": "We fry it fresh and bring it to your door."}
  ]
}$json$),
('our-story', $json${
  "title": "Meet Chef Shaheen Islam",
  "intro": "Good food, made properly.",
  "body": "Chef Shaheen Islam trained at the Professional Cooking Academy (PCA), Dhaka, and holds professional certificates in Fast Food & Frozen Food, Authentic Biryani, Chinese and Special Kabab.\n\nHer training covers what matters most in your food: food safety and sanitation, careful preparation, kitchen organisation and presentation.\n\nAt Flavory, she brings all of it into one simple promise: real chicken, measured recipes, a clean kitchen, and every piece fried fresh when you order. No shortcuts.",
  "sign_off": "Shaheen",
  "poster": "/brand/chef-poster.webp",
  "photos": []
}$json$),
('delivery', $json${
  "title": "Delivery & FAQ",
  "intro": "We deliver to Dhanmondi and Mohammadpur from our kitchen in Lalmatia.",
  "faq": [
    {"q": "Where do you deliver?", "a": "Dhanmondi and Mohammadpur only for now. You can also pick up your order from our kitchen."},
    {"q": "How do I pay?", "a": "Cash on delivery."},
    {"q": "What if my food is not crispy?", "a": "Not crispy when it arrives? We replace it free. Call or message us as soon as your order arrives."},
    {"q": "Can I order for later?", "a": "Yes. Choose a time slot at checkout. When we are closed you can schedule your order for our next opening."},
    {"q": "Do you have allergen information?", "a": "Our food contains wheat, egg and soy unless the menu says otherwise. It is all cooked in one kitchen, so please tell us about any allergy before you order."},
    {"q": "Is the food in the photos what I will get?", "a": "Yes. Real photo, real portion."}
  ]
}$json$),
('contact', $json${
  "title": "Talk to us",
  "intro": "The fastest way to reach us is by phone during opening hours."
}$json$),
('privacy', $json${
  "title": "Privacy Policy",
  "sections": [
    {"h": "What we collect", "b": "When you order we collect your name, phone number, delivery address and any note you add. We need these to cook and deliver your order, and nothing else."},
    {"h": "How we use it", "b": "We use your details to confirm and deliver your order, to handle complaints, and to recognise returning customers. We do not sell your details and we do not send you marketing messages."},
    {"h": "Your receipt link", "b": "Your receipt has a private link. It shows your order, first name and area, but never your phone number or full address. Anyone you share the link with can see it."},
    {"h": "WhatsApp", "b": "If you confirm on WhatsApp, your order details go to us through WhatsApp, and WhatsApp's own privacy policy applies to that message."},
    {"h": "Deleting your data", "b": "Call us and we will delete your name, phone number and address from our records. We keep the order amounts, with no personal details attached, for our accounts."}
  ]
}$json$),
('terms', $json${
  "title": "Terms",
  "sections": [
    {"h": "Ordering", "b": "An order is confirmed when we confirm it by phone or WhatsApp. We may cancel an order we cannot fulfil, and we will tell you if we do."},
    {"h": "Delivery", "b": "We deliver to the areas shown at checkout. Delivery times are our best estimate."},
    {"h": "Prices", "b": "Prices are in Bangladeshi Taka and may change. The total on your receipt is the amount you pay."},
    {"h": "Allergens", "b": "Please read the menu and tell us about any allergy before ordering. Our food is prepared in one kitchen."},
    {"h": "Offers", "b": "Coupons and rewards cannot be exchanged for cash, and they may have conditions shown when you use them."}
  ]
}$json$),
('refund', $json${
  "title": "Refund & Replacement Policy",
  "sections": [
    {"h": "The crispy guarantee", "b": "Not crispy when it arrives? We replace it free. Call or message us as soon as your order arrives."},
    {"h": "Wrong or missing items", "b": "Tell us as soon as you notice and we will send what was missing or replace what was wrong."},
    {"h": "Refunds", "b": "If we cannot replace your food, we refund what you paid for the affected items."},
    {"h": "Cancelling", "b": "Call us as soon as you can. Once your food is cooking we may not be able to cancel it."}
  ]
}$json$);

do $$
declare
  chicken uuid;
  burgers uuid;
  it uuid;
begin
  insert into public.categories (name, sort_order) values ('Crispy Chicken', 0) returning id into chicken;
  insert into public.categories (name, sort_order) values ('Burgers', 1) returning id into burgers;

  insert into public.menu_items (category_id, name, description, ingredients, suggest, is_sample, sort_order)
  values (chicken, 'Crispy Chicken Nuggets', 'Real chicken in a crisp golden coating, fried fresh when you order.',
          'Chicken, wheat flour, breadcrumbs, egg, soy sauce, spices, oil', false, true, 0) returning id into it;
  insert into public.item_options (item_id, label, price, sort_order) values
    (it, '4 pcs', 165, 0), (it, '6 pcs', 219, 1), (it, '8 pcs', 249, 2), (it, '20 pcs', 579, 3);

  insert into public.menu_items (category_id, name, description, ingredients, suggest, is_sample, sort_order)
  values (chicken, 'Crispy Chicken Strips', 'Long strips of real chicken with a crunchy coating, fried fresh when you order.',
          'Chicken, wheat flour, breadcrumbs, egg, soy sauce, spices, oil', true, true, 1) returning id into it;
  insert into public.item_options (item_id, label, price, sort_order) values
    (it, '4 pcs', 219, 0), (it, '6 pcs', 299, 1), (it, '8 pcs', 379, 2);

  insert into public.menu_items (category_id, name, description, ingredients, is_sample, sort_order)
  values (burgers, 'Crispy Chicken Burger', 'A crisp chicken fillet in a soft bun, fried fresh when you order.',
          'Chicken, bun, lettuce, sauce, wheat flour, egg, soy, spices, oil', true, 2) returning id into it;
  insert into public.item_options (item_id, label, price) values (it, '', 220);

  insert into public.menu_items (category_id, name, description, ingredients, badge, is_sample, sort_order)
  values (burgers, 'Spicy Chicken Burger', 'Our crisp chicken fillet with a spicy kick, in a soft bun.',
          'Chicken, bun, lettuce, spicy sauce, wheat flour, egg, soy, spices, oil', 'Spicy', true, 3) returning id into it;
  insert into public.item_options (item_id, label, price) values (it, '', 240);

  insert into public.option_costs (option_id) select id from public.item_options;
end $$;
