CREATE SCHEMA billing;

CREATE TABLE public.accounts (
    id uuid PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE billing.invoices (
    id bigint PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES public.accounts (id),
    total numeric(12,2) NOT NULL
);

CREATE TABLE billing.payments (
    id bigint PRIMARY KEY,
    invoice_id bigint NOT NULL,
    CONSTRAINT payments_invoice_fk FOREIGN KEY (invoice_id) REFERENCES billing.invoices (id) ON DELETE CASCADE
);
