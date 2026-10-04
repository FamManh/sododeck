-- A file with a syntax error on line 12




CREATE TABLE ok (
    id integer PRIMARY KEY
);

CREATE TABLE broken (
    id integer PRIMARY KEY,
    name text NOT NULL,,
    other text
);
