// Use production backend URL when deployed, localhost when running locally
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://ace-botany-478821-h7.web.app';  // Replace with actual Cloud Run URL after deployment


async function loadCafes() {
    const response = await fetch(`${API_URL}/cafes`);
    const cafes = await response.json();

    // Populate Summary Table
    const tableBody = document.getElementById('cafeStatsTableBody');
    if (tableBody) {
        tableBody.innerHTML = cafes.map(cafe => `
            <tr>
                <td>${cafe.name}</td>
                <td>
                    <span class="text-green font-bold">${cafe.averageRating}⭐</span>
                </td>
                <td>${cafe.totalRatings}</td>
                <td>
                    <button onclick="viewCafeStats('${cafe._id}')" class="btn-green btn-small">Stats</button>
                </td>
            </tr>
        `).join('');
    }

    const list = document.getElementById('cafeList');
    list.innerHTML = cafes.map(cafe => `
        <div class="cafe-item">
            <div class="flex-between">
                <div>
                    <strong>${cafe.name}</strong> (Bldg ${cafe.building})
                </div>
                <div>
                    <button onclick="deleteCafe('${cafe._id}')" class="btn-red btn-small">Delete</button>
                </div>
            </div>
            
            <!-- Items Section -->
            <div class="items-section">
                <h4>Menu Items</h4>
                <ul class="cafe-list">
                    ${cafe.items && cafe.items.length > 0 ? cafe.items.map(item => `
                        <li style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #eee;">
                            <div class="flex-start">
                                <div>
                                    <div class="font-bold">${item.name}</div>
                                    <div style="font-size: 0.85em; color: #666;">
                                        <span class="badge" style="margin-right: 5px;">${item.type || 'other'}</span>
                                        <span class="text-green font-bold">$${(item.price || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                                <div>
                                    <button onclick="deleteItem('${cafe._id}', '${item._id}')" class="btn-red btn-xs" style="color: white; border: none; cursor: pointer;">Delete</button>
                                </div>
                            </div>
                            <div class="flex-gap">
                                <input type="number" id="rating-item-${item._id}" placeholder="1-5" min="1" max="5" onkeydown="return false" style="width: 50px; padding: 5px;">
                                <input type="text" id="comment-item-${item._id}" placeholder="Comment..." style="width: 150px; padding: 5px;">
                                <button onclick="rateItem('${cafe._id}', '${item._id}')" class="btn-small">Rate Item</button>
                            </div>
                        </li>
                    `).join('') : '<li style="color: #777;">No items yet.</li>'}
                </ul>
                <div style="margin-top: 10px;">
                    <div class="flex-gap" style="margin-bottom: 5px;">
                        <input type="text" id="newItem-${cafe._id}" placeholder="Item Name" style="width: 150px;">
                        <input type="number" id="newItemPrice-${cafe._id}" placeholder="Price" step="0.01" style="width: 80px;">
                        <select id="newItemType-${cafe._id}" style="width: 100px;">
                            <option value="entree">Entree</option>
                            <option value="drink">Drink</option>
                            <option value="side">Side</option>
                            <option value="dessert">Dessert</option>
                            <option value="other">Other</option>
                        </select>
                        <button onclick="addItem('${cafe._id}')" class="btn-small">Add Item</button>
                    </div>
                </div>
            </div>

            <!-- Rate Cafe Section -->
            <div class="rate-section">
                <strong>Rate this Cafe:</strong>
                <div style="margin-top: 5px;">
                    <input type="number" id="rating-${cafe._id}" placeholder="1-5" min="1" max="5" onkeydown="return false" style="width: 60px;">
                    <input type="text" id="comment-${cafe._id}" placeholder="Comment (max 200 chars)" maxlength="200" style="width: 200px;">
                    <button onclick="rateCafe('${cafe._id}')" class="btn-small">Rate Cafe</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function deleteCafe(id) {
    if (!confirm('Are you sure you want to delete this cafe? This will also delete all its items and reviews.')) {
        return;
    }

    await fetch(`${API_URL}/cafes/${id}`, {
        method: 'DELETE'
    });

    loadCafes();
    // Close modal if open
    closeCafeStats();
}

async function addCafe() {
    const name = document.getElementById('cafeName').value;
    const building = document.getElementById('building').value;

    const response = await fetch(`${API_URL}/cafes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, building })
    });

    if (response.ok) {
        // Clear inputs and reload list
        document.getElementById('cafeName').value = '';
        document.getElementById('building').value = '';
        loadCafes();
    } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
    }
}

async function addItem(cafeId) {
    const nameInput = document.getElementById(`newItem-${cafeId}`);
    const priceInput = document.getElementById(`newItemPrice-${cafeId}`);
    const typeInput = document.getElementById(`newItemType-${cafeId}`);

    const name = nameInput.value;
    const price = parseFloat(priceInput.value) || 0.0;
    const type = typeInput.value;

    if (!name) return;

    const response = await fetch(`${API_URL}/cafes/${cafeId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price, type })
    });

    if (response.ok) {
        nameInput.value = '';
        priceInput.value = '';
        typeInput.value = 'entree';
        loadCafes();
    } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
    }
}

async function rateItem(cafeId, itemId) {
    const ratingInput = document.getElementById(`rating-item-${itemId}`);
    const commentInput = document.getElementById(`comment-item-${itemId}`);
    const rating = parseInt(ratingInput.value);
    const comment = commentInput.value;

    if (!rating) {
        alert('Please enter a rating');
        return;
    }

    if (rating < 1 || rating > 5) {
        alert('Rating must be between 1 and 5');
        return;
    }

    await fetch(`${API_URL}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cafeId, itemId, rating, comment })
    });
    alert('Item Rating Saved!');

    ratingInput.value = '';
    commentInput.value = '';
}

async function deleteItem(cafeId, itemId) {
    if (!confirm('Are you sure you want to delete this item? This will also delete all its reviews.')) {
        return;
    }

    const response = await fetch(`${API_URL}/items/${itemId}`, {
        method: 'DELETE'
    });

    if (response.ok) {
        loadCafes();
    } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error}`);
    }
}

async function viewItemStats(itemId) {
    document.getElementById('itemStatsModal').style.display = 'block';
    document.getElementById('itemStatsContent').innerHTML = 'Loading...';

    try {
        const response = await fetch(`${API_URL}/items/${itemId}/stats`);
        const stats = await response.json();

        document.getElementById('itemStatsTitle').innerText = `📊 Stats for ${stats.item.name}`;

        let reviewsHtml = '';
        if (stats.reviews.length === 0) {
            reviewsHtml = '<p style="color: #777;">No reviews yet.</p>';
        } else {
            reviewsHtml = '<ul class="cafe-list">' +
                stats.reviews.map(r => `
                    <li style="padding: 10px 0; border-bottom: 1px solid #eee;">
                        <div class="flex-between">
                            <span class="text-green font-bold" style="color: #fbbc04;">${r.rating}⭐</span>
                            <span style="color: #666; font-size: 0.8em;">${new Date(r.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div style="font-style: italic; color: #555; margin-top: 5px;">"${r.comment || ''}"</div>
                    </li>
                `).join('') +
                '</ul>';
        }

        document.getElementById('itemStatsContent').innerHTML = `
            <div class="text-center mb-20" style="padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 2.5em; font-weight: bold; color: #1a73e8;">${stats.averageRating}</div>
                <div style="color: #666;">Average Rating</div>
                <div style="font-size: 0.9em; color: #888;">(${stats.totalRatings} total ratings)</div>
                <div style="margin-top: 10px;">
                    <span class="badge">${stats.item.type}</span>
                    <span class="text-green font-bold" style="margin-left: 10px;">$${(stats.item.price || 0).toFixed(2)}</span>
                </div>
            </div>
            <h4>Recent Reviews</h4>
            ${reviewsHtml}
        `;
    } catch (err) {
        document.getElementById('itemStatsContent').innerHTML = `<p style="color: red;">Error loading stats: ${err.message}</p>`;
    }
}

function closeItemStats() {
    document.getElementById('itemStatsModal').style.display = 'none';
}

function closeCafeStats() {
    document.getElementById('cafeStatsModal').style.display = 'none';
}

async function viewCafeStats(id) {
    document.getElementById('cafeStatsModal').style.display = 'block';
    document.getElementById('cafeStatsContent').innerHTML = 'Loading...';

    try {
        const response = await fetch(`${API_URL}/cafes/${id}/stats`);
        const stats = await response.json();

        document.getElementById('cafeStatsTitle').innerText = `📊 Stats for ${stats.cafeName}`;

        // Items HTML
        let itemsHtml = '';
        if (!stats.items || stats.items.length === 0) {
            itemsHtml = '<p style="color: #777;">No items yet.</p>';
        } else {
            itemsHtml = stats.items.map(item => `
                <div style="padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${item.name}</strong>
                        <span class="badge" style="margin-left: 5px;">${item.type}</span>
                        <span class="text-green" style="margin-left: 10px;">$${(item.price || 0).toFixed(2)}</span>
                    </div>
                    <div class="text-right">
                        <div style="font-size: 1.2em; font-weight: bold; color: #1a73e8;">
                            ${item.averageRating}⭐
                        </div>
                        <div style="font-size: 0.8em; color: #666;">
                            ${item.totalRatings} rating${item.totalRatings !== 1 ? 's' : ''}
                        </div>
                        <button onclick="viewItemStats('${item._id}')" class="btn-green btn-xs" style="color: white; border: none; cursor: pointer; margin-top: 5px;">Stats</button>
                    </div>
                </div>
            `).join('');
        }

        // Recent Ratings HTML
        let recentHtml = '';
        if (stats.recentRatings.length === 0) {
            recentHtml = '<li>No ratings yet.</li>';
        } else {
            recentHtml = stats.recentRatings.map(r => `
                <li style="padding: 5px 0; border-bottom: 1px solid #eee;">
                    <strong>${r.rating}⭐</strong> - "${r.comment}" 
                    <span style="color: #888; font-size: 0.8em;">(${new Date(r.timestamp).toLocaleDateString()})</span>
                </li>
            `).join('');
        }

        document.getElementById('cafeStatsContent').innerHTML = `
            <div class="flex-between text-center mb-20" style="justify-content: space-around;">
                <div>
                    <h2 style="margin: 0; color: #1a73e8;">${stats.totalRatings}</h2>
                    <p style="margin: 5px 0; color: #666;">Total Cafe Ratings</p>
                </div>
                <div>
                    <h2 style="margin: 0; color: #1a73e8;">${stats.averageRating}</h2>
                    <p style="margin: 5px 0; color: #666;">Average Cafe Rating</p>
                </div>
            </div>

            <div class="mt-20">
                <h4>🍽️ Menu Items</h4>
                <div style="padding: 0;">
                    ${itemsHtml}
                </div>
            </div>

            <div class="mt-20">
                <h4>🕒 Recent Cafe Ratings</h4>
                <ul class="cafe-list">
                    ${recentHtml}
                </ul>
            </div>
        `;
    } catch (err) {
        document.getElementById('cafeStatsContent').innerHTML = `<p style="color: red;">Error loading stats: ${err.message}</p>`;
    }
}

async function rateCafe(id) {
    const rating = parseInt(document.getElementById(`rating-${id}`).value);
    const comment = document.getElementById(`comment-${id}`).value;

    if (!rating) {
        alert('Please enter a rating');
        return;
    }

    if (rating < 1 || rating > 5) {
        alert('Rating must be between 1 and 5');
        return;
    }

    await fetch(`${API_URL}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cafeId: id, rating, comment })
    });
    alert('Rating Saved!');
    // Refresh stats if we are currently viewing this cafe
    const modal = document.getElementById('cafeStatsModal');
    if (modal.style.display === 'block') {
        viewCafeStats(id);
    }

    // Clear inputs
    document.getElementById(`rating-${id}`).value = '';
    document.getElementById(`comment-${id}`).value = '';
}

// Load cafes on startup
loadCafes();
