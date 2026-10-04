CREATE TABLE "Order Items" (
    "Line Id" integer PRIMARY KEY,
    "orderId" integer NOT NULL,
    label text COLLATE "C",
    doubled integer GENERATED ALWAYS AS ("Line Id" * 2) STORED
);

CREATE TABLE a (
    id integer PRIMARY KEY,
    b_id integer
);

CREATE TABLE b (
    id integer PRIMARY KEY,
    a_id integer REFERENCES a (id)
);

ALTER TABLE a ADD CONSTRAINT a_b_fk FOREIGN KEY (b_id) REFERENCES b (id);

CREATE TABLE people (
    id integer PRIMARY KEY,
    mentor_id integer REFERENCES people (id),
    home_id integer,
    work_id integer
);

CREATE TABLE places (
    id integer PRIMARY KEY
);

ALTER TABLE people ADD CONSTRAINT people_home_fk FOREIGN KEY (home_id) REFERENCES places (id);
ALTER TABLE people ADD CONSTRAINT people_work_fk FOREIGN KEY (work_id) REFERENCES places (id);

CREATE TABLE places (
    id integer PRIMARY KEY,
    name text
);

CREATE TABLE orphans (
    id integer PRIMARY KEY,
    account_id integer REFERENCES accounts (id)
);

ALTER TABLE places ADD COLUMN note text;
ALTER TABLE people DROP COLUMN work_id;
ALTER TABLE people RENAME TO persons;
