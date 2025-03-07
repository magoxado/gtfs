// Instead of hardcoding the data, we'll load it from the GitHub repository
const gtfsData = {
    agency: [],
    routes: [],
    stops: [],
    trips: [],
    stop_times: [],
    calendar: [],
    calendar_dates: [],
    shapes: []
};

// Function to parse CSV content into objects
function parseCSV(csv) {
    const lines = csv.split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',');
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',');
        const entry = {};
        
        for (let j = 0; j < headers.length; j++) {
            entry[headers[j]] = values[j] || '';
        }
        
        results.push(entry);
    }
    
    return results;
}

// Load GTFS files from GitHub repository
async function loadGTFSData() {
    const baseUrl = 'https://raw.githubusercontent.com/magoxado/gtfs/main/';
    const files = [
        'agency.txt',
        'routes.txt',
        'stops.txt',
        'trips.txt',
        'stop_times.txt',
        'calendar.txt',
        'calendar_dates.txt',
        'shapes.txt'
    ];
    
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Loading GTFS data from repository...</p>
    `;
    document.body.appendChild(loadingIndicator);
    
    try {
        await Promise.all(files.map(async (file) => {
            const response = await fetch(baseUrl + file);
            if (!response.ok) {
                throw new Error(`Failed to load ${file}: ${response.status} ${response.statusText}`);
            }
            
            const text = await response.text();
            const property = file.replace('.txt', '');
            gtfsData[property] = parseCSV(text);
            
            console.log(`Loaded ${gtfsData[property].length} entries from ${file}`);
        }));
        
        console.log('All GTFS data loaded successfully');
        document.body.removeChild(loadingIndicator);
        initApp(); // Initialize the app once data is loaded
    } catch (error) {
        console.error('Error loading GTFS data:', error);
        loadingIndicator.innerHTML = `
            <div class="error-icon">⚠️</div>
            <p>Error loading GTFS data: ${error.message}</p>
            <button onclick="location.reload()">Retry</button>
        `;
    }
}

// Start loading data when the script loads
document.addEventListener('DOMContentLoaded', loadGTFSData);

// Add to gtfsData.js
async function loadGTFSData() {
    // Check if we have cached data and it's not too old
    const cachedData = localStorage.getItem('gtfsData');
    const cachedTimestamp = localStorage.getItem('gtfsDataTimestamp');
    
    // Use cached data if it's less than a day old
    if (cachedData && cachedTimestamp && 
        (Date.now() - parseInt(cachedTimestamp)) < 86400000) {
        try {
            Object.assign(gtfsData, JSON.parse(cachedData));
            console.log('Using cached GTFS data');
            initApp();
            return;
        } catch (e) {
            console.error('Error parsing cached data:', e);
            // Continue to fetch fresh data
        }
    }
    
    // Original loading code...
    const baseUrl = 'https://raw.githubusercontent.com/magoxado/gtfs/main/';
    // ...
    
    // After successfully loading data, cache it
    localStorage.setItem('gtfsData', JSON.stringify(gtfsData));
    localStorage.setItem('gtfsDataTimestamp', Date.now().toString());
}