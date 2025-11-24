const { createApp, ref, onMounted, reactive } = Vue;

// Use production backend URL when deployed, localhost when running locally
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://cafe-rater--ace-botany-478821-h7.us-east4.hosted.app';


createApp({
    setup() {
        // --- State ---
        const cafes = ref([]);
        const newCafe = reactive({ name: '', building: '' });

        // We need to store input state for each cafe (for adding items/ratings)
        // Keyed by cafe._id
        const cafeInputs = reactive({});

        // Modals
        const cafeStats = ref(null); // The stats data for the modal
        const itemStats = ref(null); // The stats data for the modal
        const showCafeModal = ref(false);
        const showItemModal = ref(false);

        // --- Actions ---

        // 1. Load Cafes
        const loadCafes = async () => {
            try {
                const res = await fetch(`${API_URL}/cafes`);
                const data = await res.json();
                cafes.value = data;

                // Initialize inputs for each cafe if not already there
                data.forEach(cafe => {
                    if (!cafeInputs[cafe._id]) {
                        cafeInputs[cafe._id] = {
                            newItem: { name: '', price: '', type: 'entree' },
                            rating: { score: '', comment: '' },
                            itemRatings: {} // Keyed by item._id
                        };
                    }
                    // Initialize item rating inputs
                    if (cafe.items) {
                        cafe.items.forEach(item => {
                            if (!cafeInputs[cafe._id].itemRatings[item._id]) {
                                cafeInputs[cafe._id].itemRatings[item._id] = { score: '', comment: '' };
                            }
                        });
                    }
                });
            } catch (err) {
                console.error("Failed to load cafes", err);
            }
        };

        // 2. Add Cafe
        const addCafe = async () => {
            if (!newCafe.name || !newCafe.building) return;

            const res = await fetch(`${API_URL}/cafes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCafe)
            });

            if (res.ok) {
                newCafe.name = '';
                newCafe.building = '';
                loadCafes();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        };

        // 3. Delete Cafe
        const deleteCafe = async (id) => {
            if (!confirm('Delete this cafe?')) return;
            await fetch(`${API_URL}/cafes/${id}`, { method: 'DELETE' });
            loadCafes();
            if (showCafeModal.value) closeCafeStats();
        };

        // 4. Add Item
        const addItem = async (cafeId) => {
            const inputs = cafeInputs[cafeId].newItem;
            if (!inputs.name) return;

            const res = await fetch(`${API_URL}/cafes/${cafeId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: inputs.name,
                    price: parseFloat(inputs.price) || 0,
                    type: inputs.type
                })
            });

            if (res.ok) {
                inputs.name = '';
                inputs.price = '';
                inputs.type = 'entree';
                loadCafes();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        };

        // 5. Delete Item
        const deleteItem = async (itemId) => {
            if (!confirm('Delete this item?')) return;
            await fetch(`${API_URL}/items/${itemId}`, { method: 'DELETE' });
            loadCafes();
        };

        // 6. Rate Cafe
        const rateCafe = async (cafeId) => {
            const inputs = cafeInputs[cafeId].rating;
            const rating = parseInt(inputs.score);

            if (!rating || rating < 1 || rating > 5) {
                alert('Please enter a rating between 1-5');
                return;
            }

            await fetch(`${API_URL}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cafeId,
                    rating,
                    comment: inputs.comment
                })
            });

            alert('Rating Saved!');
            inputs.score = '';
            inputs.comment = '';

            // Refresh stats if open
            if (showCafeModal.value && cafeStats.value && cafeStats.value.cafeName) {
                // We'd need the ID, but we can just reload the current one
                // For simplicity, we'll just reload the list
            }
            loadCafes(); // Update the summary table
        };

        // 7. Rate Item
        const rateItem = async (cafeId, itemId) => {
            const inputs = cafeInputs[cafeId].itemRatings[itemId];
            const rating = parseInt(inputs.score);

            if (!rating || rating < 1 || rating > 5) {
                alert('Please enter a rating between 1-5');
                return;
            }

            await fetch(`${API_URL}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cafeId,
                    itemId,
                    rating,
                    comment: inputs.comment
                })
            });

            alert('Item Rating Saved!');
            inputs.score = '';
            inputs.comment = '';
        };

        // 8. View Stats (Modals)
        const viewCafeStats = async (id) => {
            showCafeModal.value = true;
            cafeStats.value = null; // Loading state
            const res = await fetch(`${API_URL}/cafes/${id}/stats`);
            cafeStats.value = await res.json();
        };

        const closeCafeStats = () => {
            showCafeModal.value = false;
        };

        const viewItemStats = async (itemId) => {
            showItemModal.value = true;
            itemStats.value = null;
            const res = await fetch(`${API_URL}/items/${itemId}/stats`);
            itemStats.value = await res.json();
        };

        const closeItemStats = () => {
            showItemModal.value = false;
        };

        // Lifecycle
        onMounted(() => {
            loadCafes();
        });

        return {
            cafes,
            newCafe,
            cafeInputs,
            cafeStats,
            itemStats,
            showCafeModal,
            showItemModal,
            loadCafes,
            addCafe,
            deleteCafe,
            addItem,
            deleteItem,
            rateCafe,
            rateItem,
            viewCafeStats,
            closeCafeStats,
            viewItemStats,
            closeItemStats
        };
    }
}).mount('#app');
