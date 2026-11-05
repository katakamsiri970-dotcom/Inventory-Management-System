
// Display Current Date
const dateElement = document.getElementById("currentDate");

if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

// Load Dashboard Data
async function loadDashboard() {
    try {
        const [productsResponse, suppliersResponse, transactionsResponse] =
            await Promise.all([
                fetch("/products"),
                fetch("/suppliers"),
                fetch("/transactions")
            ]);

        if (!productsResponse.ok || !suppliersResponse.ok || !transactionsResponse.ok) {
            throw new Error("Unable to fetch dashboard data");
        }

        const products = await productsResponse.json();
        const suppliers = await suppliersResponse.json();
        const transactions = await transactionsResponse.json();

        // Total Products
        document.getElementById("totalProducts").textContent = products.length;

        // Total Suppliers
        document.getElementById("totalSuppliers").textContent = suppliers.length;

        // Total Stock Units
        const totalStock = products.reduce(
            (sum, product) => sum + Number(product.quantity || 0), 0
        );

        document.getElementById("totalStock").textContent = totalStock;

        // Low Stock Products
        const lowStockProducts = products.filter(product =>
            Number(product.quantity) > 0 &&
            Number(product.quantity) <= Number(product.reorder_level)
        );

        document.getElementById("lowStock").textContent = lowStockProducts.length;

        // Recent Transactions
        const transactionTable = document.getElementById("recentTransactions");

        if (transactions.length === 0) {
            transactionTable.innerHTML =
                '<tr><td colspan="5" class="empty">No transactions found</td></tr>';
        } else {
            transactionTable.innerHTML = transactions
                .slice(-5)
                .reverse()
                .map(transaction => `
                    <tr>
                        <td>${transaction.transaction_id}</td>
                        <td>${transaction.product_id}</td>
                        <td>${transaction.transaction_type}</td>
                        <td>${transaction.quantity}</td>
                        <td>${transaction.transaction_date ? new Date(transaction.transaction_date).toLocaleDateString("en-IN") : "-"}</td>
                    </tr>
                `).join("");
        }

        // Low Stock Alerts
        const lowStockList = document.getElementById("lowStockList");

        if (lowStockProducts.length === 0) {
            lowStockList.innerHTML =
                '<p class="empty">No low stock products</p>';
        } else {
            lowStockList.innerHTML = lowStockProducts.map(product => `
                <div class="low-stock-item">
                    <div>
                        <h4>${product.product_name}</h4>
                        <small>Remaining: ${product.quantity}</small>
                    </div>
                    <span>Low Stock</span>
                </div>
            `).join("");
        }

    } catch (error) {
        console.error("Dashboard Error:", error);
        document.getElementById("recentTransactions").innerHTML =
            '<tr><td colspan="5" class="empty">Unable to load data. Check server.</td></tr>';
        document.getElementById("lowStockList").innerHTML =
            '<p class="empty">Unable to load stock information</p>';
    }
}

loadDashboard();
