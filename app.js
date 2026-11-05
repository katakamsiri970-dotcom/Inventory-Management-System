
const express = require("express");
const db = require("./db");

const app = express();
const PORT = 3000;
console.log("CURRENT APP.JS FILE:", __filename);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Home page
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

// GET ALL PRODUCTS
app.get("/products", (req, res) => {
    db.query("SELECT * FROM products", (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// ADD PRODUCT
app.post("/products", (req, res) => {
    const { product_name, category, price, quantity, reorder_level } = req.body;

    const sql = `
        INSERT INTO products
        (product_name, category, price, quantity, reorder_level)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [product_name, category, price, quantity, reorder_level],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({
                message: "Product added successfully!",
                product_id: result.insertId
            });
        }
    );
});

// GET ONE PRODUCT

// GET ALL STOCK TRANSACTIONS
app.get("/transactions", (req, res) => {

    const sql = `
        SELECT
            transaction_id,
            product_id,
            supplier_id,
            transaction_type,
            quantity,
            DATE_FORMAT(transaction_date, '%Y-%m-%d') AS transaction_date
        FROM stock_transactions
        ORDER BY transaction_id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.json(results);
    });
});


// ADD STOCK TRANSACTION
app.post("/transactions", (req, res) => {

    const {
        product_id,
        supplier_id,
        transaction_type,
        quantity,
        transaction_date
    } = req.body;

    const type = String(transaction_type || "").toLowerCase();
    const qty = Number(quantity);
    const productId = Number(product_id);

    if (!Number.isInteger(productId) || productId <= 0 ||
        !Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({
            message: "Enter a valid Product ID and Quantity."
        });
    }

    if (!["purchase", "sale"].includes(type)) {
        return res.status(400).json({
            message: "Transaction type must be Purchase or Sale."
        });
    }

    const supplierId = supplier_id ? Number(supplier_id) : null;

    if (supplierId !== null &&
        (!Number.isInteger(supplierId) || supplierId <= 0)) {
        return res.status(400).json({
            message: "Enter a valid Supplier ID."
        });
    }

    if (type === "sale" && supplierId !== null) {
        return res.status(400).json({
            message: "Supplier ID is not required for a sale."
        });
    }

    const date = transaction_date || new Date().toISOString().slice(0, 10);

    db.beginTransaction((err) => {

        if (err) {
            return res.status(500).json({ error: err.message });
        }

        db.query(
            "SELECT quantity FROM products WHERE product_id = ? FOR UPDATE",
            [productId],
            (err, results) => {

                if (err) {
                    return db.rollback(() =>
                        res.status(500).json({ error: err.message })
                    );
                }

                if (results.length === 0) {
                    return db.rollback(() =>
                        res.status(404).json({
                            message: "Product not found."
                        })
                    );
                }

                const currentStock = Number(results[0].quantity);

                if (type === "sale" && currentStock < qty) {
                    return db.rollback(() =>
                        res.status(400).json({
                            message: "Insufficient stock. Available quantity: " + currentStock
                        })
                    );
                }

                if (supplierId !== null) {

                    db.query(
                        "SELECT supplier_id FROM suppliers WHERE supplier_id = ?",
                        [supplierId],
                        (err, supplierResults) => {

                            if (err) {
                                return db.rollback(() =>
                                    res.status(500).json({ error: err.message })
                                );
                            }

                            if (supplierResults.length === 0) {
                                return db.rollback(() =>
                                    res.status(404).json({
                                        message: "Supplier not found."
                                    })
                                );
                            }

                            saveTransaction();
                        }
                    );

                } else {
                    saveTransaction();
                }

                function saveTransaction() {

                    const newStock = type === "purchase"
                        ? currentStock + qty
                        : currentStock - qty;

                    db.query(
                        "UPDATE products SET quantity = ? WHERE product_id = ?",
                        [newStock, productId],
                        (err) => {

                            if (err) {
                                return db.rollback(() =>
                                    res.status(500).json({ error: err.message })
                                );
                            }

                            const sql = `
                                INSERT INTO stock_transactions
                                (product_id, supplier_id, transaction_type,
                                 quantity, transaction_date)
                                VALUES (?, ?, ?, ?, ?)
                            `;

                            db.query(
                                sql,
                                [productId, supplierId, type, qty, date],
                                (err, result) => {

                                    if (err) {
                                        return db.rollback(() =>
                                            res.status(500).json({ error: err.message })
                                        );
                                    }

                                    db.commit((err) => {

                                        if (err) {
                                            return db.rollback(() =>
                                                res.status(500).json({
                                                    error: err.message
                                                })
                                            );
                                        }

                                        res.json({
                                            message: "Transaction added successfully!",
                                            transaction_id: result.insertId,
                                            updated_stock: newStock
                                        });
                                    });
                                }
                            );
                        }
                    );
                }
            }
        );
    });
});
app.get("/products/:id", (req, res) => {
    db.query(
        "SELECT * FROM products WHERE product_id = ?",
        [req.params.id],
        (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) {
                return res.status(404).json({ message: "Product not found" });
            }
            res.json(results[0]);
        }
    );
});

// UPDATE PRODUCT
app.put("/products/:id", (req, res) => {
    const { product_name, category, price, quantity, reorder_level } = req.body;

    const sql = `
        UPDATE products
        SET product_name = ?, category = ?, price = ?,
            quantity = ?, reorder_level = ?
        WHERE product_id = ?
    `;

    db.query(sql,
        [product_name, category, price, quantity, reorder_level, req.params.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Product not found" });
            }
            res.json({ message: "Product updated successfully!" });
        }
    );
});

// DELETE PRODUCT
app.delete("/products/:id", (req, res) => {
    db.query(
        "DELETE FROM products WHERE product_id = ?",
        [req.params.id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Product not found" });
            }
            res.json({ message: "Product deleted successfully!" });
        }
    );
});

// GET ALL SUPPLIERS

app.get("/suppliers", (req, res) => {
    console.log("SUPPLIERS API CALLED");

    db.query("SELECT * FROM suppliers", (err, results) => {
        if (err) {
            console.log("SUPPLIER DATABASE ERROR:", err);
            return res.status(500).json({ error: err.message });
        }

        console.log("SUPPLIER RECORDS:", results.length);
        res.json(results);
    });
});

// ADD SUPPLIER
app.post("/suppliers", (req, res) => {
    const { name, company, phone, email, address } = req.body;

    const sql = `
        INSERT INTO suppliers (name, company, phone, email, address)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [name, company, phone, email, address], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({
            message: "Supplier added successfully!",
            supplier_id: result.insertId
        });
    });
});

// GET ONE SUPPLIER
app.get("/suppliers/:id", (req, res) => {
    db.query(
        "SELECT * FROM suppliers WHERE supplier_id = ?",
        [req.params.id],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (results.length === 0) {
                return res.status(404).json({ message: "Supplier not found" });
            }
            res.json(results[0]);
        }
    );
});

// UPDATE SUPPLIER
app.put("/suppliers/:id", (req, res) => {
    const { name, company, phone, email, address } = req.body;

    const sql = `
        UPDATE suppliers
        SET name = ?, company = ?, phone = ?, email = ?, address = ?
        WHERE supplier_id = ?
    `;

    db.query(
        sql,
        [name, company, phone, email, address, req.params.id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Supplier not found" });
            }
            res.json({ message: "Supplier updated successfully!" });
        }
    );
});

// DELETE SUPPLIER
app.delete("/suppliers/:id", (req, res) => {
    db.query(
        "DELETE FROM suppliers WHERE supplier_id = ?",
        [req.params.id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Supplier not found" });
            }
            res.json({ message: "Supplier deleted successfully!" });
        }
    );
});
// START SERVER
console.log("ALL REGISTERED ROUTES:");

app.router.stack.forEach((layer) => {
    if (layer.route) {
        console.log(
            Object.keys(layer.route.methods).join(",").toUpperCase(),
            layer.route.path
        );
    }
});
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
