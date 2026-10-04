CREATE TABLE customers (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(100) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE company (
  id int NOT NULL,
  name varchar(100),
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE categories (
  id int NOT NULL,
  name varchar(100),
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE users (
  id int NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE orders (
  id int NOT NULL AUTO_INCREMENT,
  customer_id int NOT NULL,
  companyId int,
  status_id int,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE order_lines (
  id int NOT NULL,
  order_id int NOT NULL,
  category_id int UNIQUE,
  user_id text,
  PRIMARY KEY (id)
) ENGINE=InnoDB;
