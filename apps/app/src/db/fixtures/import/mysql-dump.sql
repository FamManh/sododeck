-- MySQL dump 10.13  Distrib 8.0.36, for Linux (x86_64)
--
-- Host: localhost    Database: shop
-- ------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;

# Customers first
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL COMMENT 'Login and receipts',
  `tier` enum('free','pro','team') NOT NULL DEFAULT 'free',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customers_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='One row per buyer';

CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` int unsigned NOT NULL,
  `status` enum('pending','paid','shipped') NOT NULL DEFAULT 'pending',
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `note` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`id`),
  KEY `orders_customer_idx` (`customer_id`),
  CONSTRAINT `orders_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4;

CREATE TABLE `order_items` (
  `order_id` bigint unsigned NOT NULL,
  `sku` varchar(40) NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `fulfilment` enum('pending','paid','shipped') DEFAULT NULL,
  PRIMARY KEY (`order_id`,`sku`),
  CONSTRAINT `order_items_order_fk` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

LOCK TABLES `customers` WRITE;
INSERT INTO `customers` VALUES (1,'a@example.com','free','2024-01-01 00:00:00',NULL),(2,'b;c@example.com','pro','2024-01-02 00:00:00',NULL);
UNLOCK TABLES;

DELIMITER ;;
CREATE PROCEDURE `touch_order`(IN oid BIGINT)
BEGIN
  UPDATE `orders` SET `total` = `total` WHERE `id` = oid;
END ;;
DELIMITER ;

/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
