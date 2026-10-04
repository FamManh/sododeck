# Edge cases · Edge DB

## a

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |
| b_id | int | FK → b.id | yes |  |  |

## b

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |
| a_id | int | FK → a.id | yes |  |  |

## categories

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |

## keyless

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| v | int |  | yes |  |  |

## misc

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |
| blank | text |  | yes |  |  |
| empty_choice | empty_choice |  | yes |  |  |
| code | text |  | yes |  |  |
| data | json |  | yes |  |  |
| price | money |  | yes |  |  |
| label | varchar |  | yes |  |  |
| flag | bool |  | no | false |  |

Indexes:

- misc_data_idx (data) · gin

## notes

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |

## order

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |
| UserId | int |  | yes |  |  |

## order items

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |
| order_id | int | FK → order.id | no |  |  |
| line note | text |  | yes |  | Quotes ' and " and -- dashes |

## pair_refs

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |
| x | int |  | yes |  |  |
| a_id | int | FK → a.id | yes |  |  |

## pairs

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| x | int | PK | no |  |  |
| y | int | PK | no |  |  |

## products

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |

## products_categories

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |

## stale

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |
| mood | text |  | yes |  |  |

Indexes:

- stale_idx (id)

## table_9

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |

## tags

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |
| name | varchar(40) |  | yes |  |  |

## billing.ledgers

| Column | Type | Key | Null | Default | Note |
| --- | --- | --- | --- | --- | --- |
| id | int | PK | no |  |  |
| account_id | uuid |  | yes |  |  |

References outside this export:

- billing.ledgers.account_id → billing.accounts.id

## Enums

### empty_choice

No values.

## Relationships

- a.b_id → b.id · many to one
- b.a_id → a.id · many to one
- order items.order_id → order.id · many to one · on delete cascade
- pair_refs.x → pairs.(x, y) · many to one
- pair_refs → misc · many to one · "mentions"
- pair_refs.a_id → a.id
- products.id → categories.id · many to many
- products.id → keyless · many to many
- stale → a.id · many to one
- tags.id → tags.id · many to many · "related"
