# GA4 tracking guide

BaSa3D sends integer VND amounts exactly as stored by the application. For example, `125000` means 125,000 VND; values are never divided by 100.

## Event dictionary

| Event | Meaning | Important parameters |
| --- | --- | --- |
| `page_view` | Initial load or Next.js soft navigation | `page_path`, `page_location` |
| `view_item_list` | Product catalog shown | `item_list_id`, `item_list_name`, `items` |
| `select_item` | Product selected from the catalog | list fields, selected `items` entry |
| `view_item` | Product detail shown | `currency`, `value`, item/SKU/variant |
| `add_to_cart` | Item added successfully to local cart | `currency`, `value`, item, quantity |
| `remove_from_cart` | Item removed from cart | `currency`, `value`, item, quantity |
| `view_cart` | Non-empty cart opened | `currency`, `value`, `items` |
| `begin_checkout` | Customer selects checkout | `currency`, `value`, `items` |
| `purchase` | Authenticated confirmation page claims the order once | `transaction_id`, `currency`, `value`, `shipping`, `items` |
| `upload_3d_file` | Attachment upload succeeds on the server | `file_name`, `file_extension`, `file_size_mb` |
| `request_custom_quote` | Custom request succeeds on the server | `technology`, `material`, `color`, `quantity`, `has_attachment` |
| `click_contact_channel` | Contact link selected | `channel`, `placement` |

Each item may include `item_id`, `item_name`, `price`, `item_category`, `item_variant`, and `quantity`. Do not register customer names, phones, email addresses, delivery addresses, attachment paths, or free-form notes as GA parameters.

The agreed schema also reserves `search`, `read_blog_post`, and `view_policy`; those event triggers need separate product/marketing confirmation before Phase 10 closes.

## Validate with DebugView

1. Create the GA4 property and web data stream, copy its `G-...` measurement ID into `NEXT_PUBLIC_GA_ID`, and restart/redeploy the app.
2. Use a non-production build (debug mode is automatic), or append `?debug_mode=1` to a production page. The Google Analytics Debugger browser extension is another option.
3. Open GA4 **Admin → Data display → DebugView** and select the test device.
4. Walk through products → detail → add to cart → cart → checkout → confirmation. Check event order and inspect currency, integer VND values, transaction ID, and item quantities.
5. Refresh the same confirmation URL. A second `purchase` must not appear. Use a new test order to repeat the purchase test because the server-side marker is intentionally permanent.

Ad blockers and browser privacy controls can suppress events. The application also safely sends nothing when `NEXT_PUBLIC_GA_ID` is empty.

## Build funnel explorations

In **Explore → Funnel exploration**, create an ordered ecommerce funnel with `view_item_list` → `select_item` → `view_item` → `add_to_cart` → `view_cart` → `begin_checkout` → `purchase`. Use an open funnel for discovery analysis or a closed funnel for strict conversion rates; break down by device category, traffic source, or campaign.

Create a second lead funnel with `upload_3d_file` (optional) → `request_custom_quote`. Break it down by material, quantity, or `has_attachment`. Mark `purchase` and `request_custom_quote` as key events only after DebugView validation and Marketing approval.
