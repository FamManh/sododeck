# Shop · Whole deck · Postgres

## addresses

| Column      | Type         | Key               | Null | Default | Note               |
| ----------- | ------------ | ----------------- | ---- | ------- | ------------------ |
| id          | uuid         | PK                | no   |         |                    |
| customer_id | uuid         | FK → customers.id | no   |         |                    |
| street      | varchar(200) |                   | no   |         |                    |
| city        | varchar(100) |                   | no   |         |                    |
| country     | char(2)      |                   | no   |         | ISO 3166-1 alpha-2 |

## audit_log

| Column    | Type        | Key | Null | Default | Note |
| --------- | ----------- | --- | ---- | ------- | ---- |
| id        | bigint      |     | no   |         |      |
| action    | varchar(40) |     | no   |         |      |
| payload   | jsonb       |     | yes  |         |      |
| logged_at | timestamptz |     | no   | `now()` |      |

Indexes:

- unnamed (logged_at) · btree

## categories

| Column    | Type         | Key                | Null | Default | Note |
| --------- | ------------ | ------------------ | ---- | ------- | ---- |
| id        | uuid         | PK                 | no   |         |      |
| parent_id | uuid         | FK → categories.id | yes  |         |      |
| name      | varchar(100) |                    | no   |         |      |

## customers

One row per buyer

| Column     | Type         | Key | Null | Default | Note |
| ---------- | ------------ | --- | ---- | ------- | ---- |
| id         | uuid         | PK  | no   |         |      |
| email      | varchar(255) | UQ  | no   |         |      |
| name       | varchar(120) |     | no   |         |      |
| created_at | timestamptz  |     | no   | `now()` |      |

Indexes:

- customers_email_lower_idx (`lower(email)`)

## order_items

| Column     | Type          | Key                  | Null | Default | Note |
| ---------- | ------------- | -------------------- | ---- | ------- | ---- |
| order_id   | uuid          | PK, FK → orders.id   | no   |         |      |
| product_id | uuid          | PK, FK → products.id | no   |         |      |
| quantity   | integer       |                      | no   |         |      |
| unit_price | numeric(10,2) |                      | no   |         |      |

Checks:

- `quantity > 0` (column quantity)

## orders

One row per checkout

| Column              | Type          | Key               | Null | Default   | Note                   |
| ------------------- | ------------- | ----------------- | ---- | --------- | ---------------------- |
| id                  | uuid          | PK                | no   |           |                        |
| customer_id         | uuid          | FK → customers.id | no   |           |                        |
| shipping_address_id | uuid          | FK → addresses.id | yes  |           |                        |
| billing_address_id  | uuid          | FK → addresses.id | yes  |           |                        |
| status              | order_status  |                   | no   | 'pending' |                        |
| total               | numeric(10,2) |                   | no   | 0         | Sum of the order items |
| created_at          | timestamptz   |                   | no   | `now()`   |                        |

Indexes:

- unnamed (customer_id, created_at)

## payments

| Column   | Type          | Key            | Null | Default | Note |
| -------- | ------------- | -------------- | ---- | ------- | ---- |
| id       | uuid          | PK             | no   |         |      |
| order_id | uuid          | FK → orders.id | no   |         |      |
| amount   | numeric(10,2) |                | no   |         |      |
| paid_at  | timestamptz   |                | yes  |         |      |

## products

Things we sell; 'active' hides them
from the store

| Column | Type          | Key | Null | Default | Note |
| ------ | ------------- | --- | ---- | ------- | ---- |
| id     | uuid          | PK  | no   |         |      |
| sku    | varchar(40)   | UQ  | no   |         |      |
| name   | varchar(200)  |     | no   |         |      |
| price  | numeric(10,2) |     | no   |         |      |
| active | boolean       |     | no   | true    |      |

Checks:

- products_price_check: `price >= 0`

## reviews

| Column      | Type     | Key               | Null | Default | Note |
| ----------- | -------- | ----------------- | ---- | ------- | ---- |
| id          | integer  | PK                | no   |         |      |
| product_id  | uuid     | FK → products.id  | no   |         |      |
| customer_id | uuid     | FK → customers.id | yes  |         |      |
| rating      | smallint |                   | no   |         |      |
| body        | text     |                   | yes  |         |      |

Checks:

- `rating BETWEEN 1 AND 5` (column rating)

## sessions

| Column     | Type        | Key           | Null | Default | Note |
| ---------- | ----------- | ------------- | ---- | ------- | ---- |
| id         | uuid        | PK            | no   |         |      |
| user_id    | uuid        | FK → users.id | no   |         |      |
| token      | varchar(64) | UQ            | no   |         |      |
| expires_at | timestamptz |               | no   |         |      |

## shipment_items

| Column      | Type    | Key                             | Null | Default | Note |
| ----------- | ------- | ------------------------------- | ---- | ------- | ---- |
| shipment_id | uuid    | PK, FK → shipments.id           | no   |         |      |
| order_id    | uuid    | PK, FK → order_items.order_id   | no   |         |      |
| product_id  | uuid    | PK, FK → order_items.product_id | no   |         |      |
| quantity    | integer |                                 | no   |         |      |

## shipments

| Column     | Type        | Key            | Null | Default | Note |
| ---------- | ----------- | -------------- | ---- | ------- | ---- |
| id         | uuid        | PK             | no   |         |      |
| order_id   | uuid        | FK → orders.id | no   |         |      |
| carrier    | varchar(80) |                | yes  |         |      |
| shipped_at | timestamptz |                | yes  |         |      |

## users

| Column       | Type         | Key | Null | Default | Note |
| ------------ | ------------ | --- | ---- | ------- | ---- |
| id           | uuid         | PK  | no   |         |      |
| email        | varchar(255) | UQ  | no   |         |      |
| display_name | varchar(80)  |     | yes  |         |      |

## Enums

### order_status

Where an order is in its life

- `pending`
- `paid`: Payment captured
- `shipped`
- `cancelled`

## Relationships

- addresses.customer_id → customers.id · many to one · on delete cascade
- categories.parent_id → categories.id · zero or many to zero or one
- order_items.order_id → orders.id · many to one · on delete cascade
- order_items.product_id → products.id · many to one · on delete restrict
- orders.customer_id → customers.id · many to one · on delete cascade · "places"
- orders.shipping_address_id → addresses.id · zero or many to zero or one · "ships to"
- orders.billing_address_id → addresses.id · zero or many to zero or one · "bills to"
- payments.order_id → orders.id · many to one
- products.id → categories.id · many to many · "listed in"
- reviews.product_id → products.id · many to one · on delete cascade
- reviews.customer_id → customers.id · zero or many to zero or one · on delete set null
- sessions.user_id → users.id · many to one · on delete cascade
- shipment_items.shipment_id → shipments.id · many to one · on delete cascade
- shipment_items.(order_id, product_id) → order_items.(order_id, product_id) · many to one
- shipments.order_id → orders.id · many to one
