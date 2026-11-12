CREATE TABLE IF NOT EXISTS inventory_items (
  product_id CHAR(36) PRIMARY KEY,
  stock_available INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_operations (
  operation_id CHAR(36) PRIMARY KEY,
  operation_type ENUM('register', 'reserve', 'release') NOT NULL,
  request_fingerprint CHAR(64) NOT NULL,
  resource_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_reservations (
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  status ENUM('active', 'released') NOT NULL,
  PRIMARY KEY (order_id, product_id),
  CONSTRAINT fk_inventory_reservation_item FOREIGN KEY (product_id) REFERENCES inventory_items(product_id)
) ENGINE=InnoDB;
