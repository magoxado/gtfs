// Constants
const SZEKESFEHERVAR_CENTER = [47.1895, 18.4221]; // Coordinates for city center

// Initialize the map
const map = L.map('map').setView(SZEKESFEHERVAR_CENTER, 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Global variables
let stopMarkers = [];
let routeLines = [];
let selectedFromStop = null;
let selectedToStop = null;

// DOM Elements
const fromStopInput = document.getElementById('from-stop');
const toStopInput = document.getElementById('to-stop');
const fromSuggestions = document.getElementById('from-suggestions');
const toSuggestions = document.getElementById('to-suggestions');
const dateSelect = document.getElementById('date-select');
const timeSelect = document.getElementById('time-select');
const searchButton = document.getElementById('search-button');
const routeList = document.getElementById('route-list');
const currentDateDisplay = document.getElementById('current-date');
const currentTimeDisplay = document.getElementById('current-time');

// Initialize the application
function initApp() {
    // Set current date and time
    const now = new Date();
    dateSelect.value = formatDate(now);
    timeSelect.value = formatTime(now);
    
    // Setup event listeners
    fromStopInput.addEventListener('input', () => showSuggestions(fromStopInput, fromSuggestions, 'from'));
    toStopInput.addEventListener('input', () => showSuggestions(toStopInput, toSuggestions, 'to'));
    searchButton.addEventListener('click', findRoutes);
    
    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!fromStopInput.contains(e.target) && !fromSuggestions.contains(e.target)) {
            fromSuggestions.style.display = 'none';
        }
        if (!toStopInput.contains(e.target) && !toSuggestions.contains(e.target)) {
            toSuggestions.style.display = 'none';
        }
    });
    
    // Update current time display
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    // Load all stops to map
    loadStopsToMap();
}

// Format date for input
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Format time for input
function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Update current time display
function updateCurrentTime() {
    const now = new Date();
    currentDateDisplay.textContent = now.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    currentTimeDisplay.textContent = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Load all stops to the map
function loadStopsToMap() {
    stopMarkers = [];
    
    gtfsData.stops.forEach(stop => {
        const marker = L.circleMarker([stop.stop_lat, stop.stop_lon], {
            radius: 5,
            fillColor: "#3388ff",
            color: "#fff",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        
        marker.bindPopup(`<strong>${stop.stop_name}</strong><br>Stop ID: ${stop.stop_id}`);
        marker.on('click', () => {
            if (!selectedFromStop) {
                selectedFromStop = stop;
                fromStopInput.value = stop.stop_name;
                marker.setStyle({ fillColor: "#00ff00" });
            } else if (!selectedToStop) {
                selectedToStop = stop;
                toStopInput.value = stop.stop_name;
                marker.setStyle({ fillColor: "#ff0000" });
            }
        });
        
        stopMarkers.push({
            marker: marker,
            stop: stop
        });
    });
}

// Show stop suggestions based on input
function showSuggestions(input, suggestionContainer, type) {
    const query = input.value.toLowerCase();
    if (query.length < 2) {
        suggestionContainer.style.display = 'none';
        return;
    }
    
    // Filter stops based on query
    const matches = gtfsData.stops.filter(stop => 
        stop.stop_name.toLowerCase().includes(query)
    ).slice(0, 10); // Limit to 10 results
    
    suggestionContainer.innerHTML = '';
    
    if (matches.length === 0) {
        suggestionContainer.style.display = 'none';
        return;
    }
    
    matches.forEach(stop => {
        const item = document.createElement('div');
        item.classList.add('suggestion-item');
        item.textContent = stop.stop_name;
        
        item.addEventListener('click', () => {
                input.value = stop.stop_name;
                suggestionContainer.style.display = 'none';
                
                // Update selected stop and map marker
                if (type === 'from') {
                    // Reset previous from marker if exists
                    if (selectedFromStop) {
                        findMarkerByStop(selectedFromStop).setStyle({ fillColor: "#3388ff" });
                    }
                    selectedFromStop = stop;
                    findMarkerByStop(stop).setStyle({ fillColor: "#00ff00" });
                    map.setView([stop.stop_lat, stop.stop_lon], 15);
                } else if (type === 'to') {
                    // Reset previous to marker if exists
                    if (selectedToStop) {
                        findMarkerByStop(selectedToStop).setStyle({ fillColor: "#3388ff" });
                    }
                    selectedToStop = stop;
                    findMarkerByStop(stop).setStyle({ fillColor: "#ff0000" });
                    map.setView([stop.stop_lat, stop.stop_lon], 15);
                }
            });
            
            suggestionContainer.appendChild(item);
        });
        
        suggestionContainer.style.display = 'block';
    }
    
    // Find marker by stop
    function findMarkerByStop(stop) {
        const markerObj = stopMarkers.find(m => m.stop.stop_id === stop.stop_id);
        return markerObj ? markerObj.marker : null;
    }
    
    // Clear route display
    function clearRouteDisplay() {
        // Clear previous route lines
        routeLines.forEach(line => map.removeLayer(line));
        routeLines = [];
        
        // Clear route list
        routeList.innerHTML = '';
    }
    
    // Find routes between selected stops
    function findRoutes() {
        if (!selectedFromStop || !selectedToStop) {
            alert("Please select both origin and destination stops");
            return;
        }
        
        clearRouteDisplay();
        
        const date = new Date(dateSelect.value + 'T' + timeSelect.value);
        const dayOfWeek = getDayOfWeekCode(date);
        const isDepTime = document.getElementById('time-option').value === 'departure';
        
        // Find service IDs operating on the selected date
        const activeServiceIds = getActiveServiceIds(date);
        if (activeServiceIds.length === 0) {
            routeList.innerHTML = '<div class="no-results">No service available on the selected date</div>';
            return;
        }
        
        // Find possible routes
        const possibleRoutes = findPossibleRoutes(
            selectedFromStop.stop_id, 
            selectedToStop.stop_id, 
            activeServiceIds, 
            date, 
            isDepTime
        );
        
        if (possibleRoutes.length === 0) {
            routeList.innerHTML = '<div class="no-results">No routes found for the selected criteria</div>';
            return;
        }
        
        // Display routes
        displayRoutes(possibleRoutes);
    }
    
    // Get day of week code (for use with service calendar)
    function getDayOfWeekCode(date) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days[date.getDay()];
    }
    
    // Get active service IDs for a specific date
    function getActiveServiceIds(date) {
        const dateString = formatDate(date).replace(/-/g, '');
        const dayOfWeek = getDayOfWeekCode(date);
        const dayOfWeekAbbr = dayOfWeek.substring(0, 2).toUpperCase();
        
        // Start with regular service based on calendar.txt
        const serviceIds = gtfsData.calendar
            .filter(calendar => {
                // Check if service is active on this day of week
                if (calendar[dayOfWeek] === '0') return false;
                
                // Check if service is active in date range
                const startDate = parseInt(calendar.start_date);
                const endDate = parseInt(calendar.end_date);
                const currentDate = parseInt(dateString);
                
                return currentDate >= startDate && currentDate <= endDate;
            })
            .map(calendar => calendar.service_id);
        
        // Apply exceptions from calendar_dates.txt
        gtfsData.calendar_dates.forEach(exception => {
            const exceptionDate = exception.date;
            if (exceptionDate === dateString) {
                if (exception.exception_type === '1') {
                    // Service added
                    if (!serviceIds.includes(exception.service_id)) {
                        serviceIds.push(exception.service_id);
                    }
                } else if (exception.exception_type === '2') {
                    // Service removed
                    const index = serviceIds.indexOf(exception.service_id);
                    if (index !== -1) {
                        serviceIds.splice(index, 1);
                    }
                }
            }
        });
        
        // For simplicity, we'll also include hardcoded common service types like HP (workdays), SZ (Saturday), VV (Sunday)
        if (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(dayOfWeek)) {
            if (!serviceIds.includes('HP')) serviceIds.push('HP');
        } else if (dayOfWeek === 'saturday') {
            if (!serviceIds.includes('SZ')) serviceIds.push('SZ');
        } else if (dayOfWeek === 'sunday') {
            if (!serviceIds.includes('VV')) serviceIds.push('VV');
        }
        
        return serviceIds;
    }
    
    // Find possible routes between stops
    function findPossibleRoutes(fromStopId, toStopId, serviceIds, date, isDepTime) {
        const routes = [];
        const departureTime = new Date(date);
        const requestTime = departureTime.getHours() * 60 + departureTime.getMinutes(); // Convert to minutes since midnight
        
        // Direct routes
        const directRoutes = findDirectRoutes(fromStopId, toStopId, serviceIds, requestTime, isDepTime);
        routes.push(...directRoutes);
        
        // Routes with one transfer (more complex routing would require more sophisticated algorithms)
        const transferRoutes = findOneTransferRoutes(fromStopId, toStopId, serviceIds, requestTime, isDepTime);
        routes.push(...transferRoutes);
        
        // Sort by departure time
        routes.sort((a, b) => {
            if (isDepTime) {
                return a.departureTime - b.departureTime;
            } else {
                return a.arrivalTime - b.arrivalTime;
            }
        });
        
        return routes.slice(0, 5); // Return top 5 routes
    }
    
    // Find direct routes between stops
    function findDirectRoutes(fromStopId, toStopId, serviceIds, requestTime, isDepTime) {
        const routes = [];
        
        // Find trips that serve both stops
        const tripsServingBothStops = gtfsData.trips.filter(trip => {
            // Check if trip runs on the requested date
            if (!serviceIds.includes(trip.service_id)) return false;
            
            // Check if this trip's route serves both stops
            const stopTimes = gtfsData.stop_times.filter(st => st.trip_id === trip.trip_id);
            
            // Create a list of stop IDs for this trip
            const stopIds = stopTimes.map(st => st.stop_id);
            
            // Check if both our stops are served, and fromStop comes before toStop
            const fromIndex = stopIds.indexOf(fromStopId);
            const toIndex = stopIds.indexOf(toStopId);
            
            return fromIndex !== -1 && toIndex !== -1 && fromIndex < toIndex;
        });
        
        tripsServingBothStops.forEach(trip => {
            // Get stop times for this trip
            const tripStopTimes = gtfsData.stop_times.filter(st => st.trip_id === trip.trip_id)
                .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
            
            // Find departure and arrival times
            const departureStopTime = tripStopTimes.find(st => st.stop_id === fromStopId);
            const arrivalStopTime = tripStopTimes.find(st => st.stop_id === toStopId);
            
            if (!departureStopTime || !arrivalStopTime) return;
            
            // Convert time strings to minutes since midnight
            const depTime = convertTimeToMinutes(departureStopTime.departure_time);
            const arrTime = convertTimeToMinutes(arrivalStopTime.arrival_time);
            
            // Check if this trip meets the time requirement
            let isValidTime;
            if (isDepTime) {
                isValidTime = depTime >= requestTime;
            } else {
                isValidTime = arrTime <= requestTime;
            }
            
            if (isValidTime) {
                // Get route details
                const route = gtfsData.routes.find(r => r.route_id === trip.route_id);
                
                // Calculate duration
                const duration = arrTime - depTime;
                
                // Get all stops between from and to
                const fromIndex = tripStopTimes.findIndex(st => st.stop_id === fromStopId);
                const toIndex = tripStopTimes.findIndex(st => st.stop_id === toStopId);
                const segmentStops = tripStopTimes.slice(fromIndex, toIndex + 1);
                
                routes.push({
                    type: 'direct',
                    departureTime: depTime,
                    arrivalTime: arrTime,
                    duration: duration,
                    route: route,
                    trip: trip,
                    segments: [
                        {
                            route: route,
                            trip: trip,
                            fromStop: selectedFromStop,
                            toStop: selectedToStop,
                            departureTime: depTime,
                            arrivalTime: arrTime,
                            segmentStops: segmentStops
                        }
                    ]
                });
            }
        });
        
        return routes;
    }
    
    // Find routes with one transfer
    function findOneTransferRoutes(fromStopId, toStopId, serviceIds, requestTime, isDepTime) {
        const routes = [];
        
        // This is a simplified approach - finding all potential transfer points
        // In reality, you'd want to use more sophisticated algorithms and heuristics
        
        // Find trips departing from our origin
        const tripsFromOrigin = gtfsData.trips.filter(trip => {
            if (!serviceIds.includes(trip.service_id)) return false;
            
            const stopIds = gtfsData.stop_times
                .filter(st => st.trip_id === trip.trip_id)
                .map(st => st.stop_id);
                
            return stopIds.includes(fromStopId);
        });
        
        // Find trips arriving at our destination
        const tripsToDestination = gtfsData.trips.filter(trip => {
            if (!serviceIds.includes(trip.service_id)) return false;
            
            const stopIds = gtfsData.stop_times
                .filter(st => st.trip_id === trip.trip_id)
                .map(st => st.stop_id);
                
            return stopIds.includes(toStopId);
        });
        
        // Find potential transfer points
        // (stops shared by trips from origin and trips to destination)
        const fromRouteStopIds = new Set();
        tripsFromOrigin.forEach(trip => {
            const stopIds = gtfsData.stop_times
                .filter(st => st.trip_id === trip.trip_id)
                .map(st => st.stop_id);
            stopIds.forEach(id => fromRouteStopIds.add(id));
        });
        
        const toRouteStopIds = new Set();
        tripsToDestination.forEach(trip => {
            const stopIds = gtfsData.stop_times
                .filter(st => st.trip_id === trip.trip_id)
                .map(st => st.stop_id);
            stopIds.forEach(id => toRouteStopIds.add(id));
        });
        
        // Find common stops
        const transferPoints = [...fromRouteStopIds].filter(id => 
            toRouteStopIds.has(id) && id !== fromStopId && id !== toStopId
        );
        
        // For each transfer point, find valid trip combinations
        transferPoints.forEach(transferStopId => {
            // Find trips from origin to transfer point
            const firstLegTrips = tripsFromOrigin.filter(trip => {
                const stopTimes = gtfsData.stop_times.filter(st => st.trip_id === trip.trip_id);
                const stopIds = stopTimes.map(st => st.stop_id);
                
                const fromIndex = stopIds.indexOf(fromStopId);
                const transferIndex = stopIds.indexOf(transferStopId);
                
                return fromIndex !== -1 && transferIndex !== -1 && fromIndex < transferIndex;
            });
            
            // Find trips from transfer point to destination
            const secondLegTrips = tripsToDestination.filter(trip => {
                const stopTimes = gtfsData.stop_times.filter(st => st.trip_id === trip.trip_id);
                const stopIds = stopTimes.map(st => st.stop_id);
                
                const transferIndex = stopIds.indexOf(transferStopId);
                const toIndex = stopIds.indexOf(toStopId);
                
                return transferIndex !== -1 && toIndex !== -1 && transferIndex < toIndex;
            });
            
            // Find valid trip combinations with reasonable transfer times
            firstLegTrips.forEach(firstLegTrip => {
                const firstLegStopTimes = gtfsData.stop_times
                    .filter(st => st.trip_id === firstLegTrip.trip_id)
                    .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
                
                const departureStopTime = firstLegStopTimes.find(st => st.stop_id === fromStopId);
                const transferArrivalStopTime = firstLegStopTimes.find(st => st.stop_id === transferStopId);
                
                if (!departureStopTime || !transferArrivalStopTime) return;
                
                const depTime = convertTimeToMinutes(departureStopTime.departure_time);
                const transferArrTime = convertTimeToMinutes(transferArrivalStopTime.arrival_time);
                
                // Only consider trips departing after requested time if we're using departure time
                if (isDepTime && depTime < requestTime) return;
                
                secondLegTrips.forEach(secondLegTrip => {
                    const secondLegStopTimes = gtfsData.stop_times
                        .filter(st => st.trip_id === secondLegTrip.trip_id)
                        .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
                    
                    const transferDepartureStopTime = secondLegStopTimes.find(st => st.stop_id === transferStopId);
                    const arrivalStopTime = secondLegStopTimes.find(st => st.stop_id === toStopId);
                    
                    if (!transferDepartureStopTime || !arrivalStopTime) return;
                    
                    const transferDepTime = convertTimeToMinutes(transferDepartureStopTime.departure_time);
                    const arrTime = convertTimeToMinutes(arrivalStopTime.arrival_time);
                    
                    // Only consider trips arriving before requested time if we're using arrival time
                    if (!isDepTime && arrTime > requestTime) return;
                    
                    // Check for reasonable transfer time (3 to 20 minutes)
                    const transferTime = transferDepTime - transferArrTime;
                    if (transferTime < 3 || transferTime > 20) return;
                    
                    // Get route details
                                        // Get route details
                const firstRoute = gtfsData.routes.find(r => r.route_id === firstLegTrip.route_id);
                const secondRoute = gtfsData.routes.find(r => r.route_id === secondLegTrip.route_id);
                
                // Calculate total duration
                const duration = arrTime - depTime;
                
                // Get all stops for each segment
                const firstLegFromIndex = firstLegStopTimes.findIndex(st => st.stop_id === fromStopId);
                const firstLegToIndex = firstLegStopTimes.findIndex(st => st.stop_id === transferStopId);
                const firstLegStops = firstLegStopTimes.slice(firstLegFromIndex, firstLegToIndex + 1);
                
                const secondLegFromIndex = secondLegStopTimes.findIndex(st => st.stop_id === transferStopId);
                const secondLegToIndex = secondLegStopTimes.findIndex(st => st.stop_id === toStopId);
                const secondLegStops = secondLegStopTimes.slice(secondLegFromIndex, secondLegToIndex + 1);
                
                // Find transfer stop details
                const transferStop = gtfsData.stops.find(stop => stop.stop_id === transferStopId);
                
                routes.push({
                    type: 'transfer',
                    departureTime: depTime,
                    arrivalTime: arrTime,
                    duration: duration,
                    transferTime: transferTime,
                    transferStop: transferStop,
                    segments: [
                        {
                            route: firstRoute,
                            trip: firstLegTrip,
                            fromStop: selectedFromStop,
                            toStop: transferStop,
                            departureTime: depTime,
                            arrivalTime: transferArrTime,
                            segmentStops: firstLegStops
                        },
                        {
                            route: secondRoute,
                            trip: secondLegTrip,
                            fromStop: transferStop,
                            toStop: selectedToStop,
                            departureTime: transferDepTime,
                            arrivalTime: arrTime,
                            segmentStops: secondLegStops
                        }
                    ]
                });
            });
        });
    });
    
    return routes;
}

// Convert time string (HH:MM:SS) to minutes since midnight
function convertTimeToMinutes(timeStr) {
    // Handle times past midnight (e.g. 25:30:00)
    const parts = timeStr.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

// Convert minutes since midnight to formatted time string
function formatMinutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Display routes on UI
function displayRoutes(routes) {
    clearRouteDisplay();
    
    routes.forEach((route, index) => {
        const routeElement = document.createElement('div');
        routeElement.classList.add('route-option');
        if (index === 0) routeElement.classList.add('selected');
        
        // Route header with times
        const header = document.createElement('div');
        header.classList.add('route-header');
        
        const timeSpan = document.createElement('span');
        timeSpan.classList.add('route-time');
        timeSpan.textContent = `${formatMinutesToTime(route.departureTime)} - ${formatMinutesToTime(route.arrivalTime)}`;
        
        const durationSpan = document.createElement('span');
        durationSpan.classList.add('route-duration');
        // Format duration as hours and minutes
        const hours = Math.floor(route.duration / 60);
        const mins = route.duration % 60;
        let durationText = '';
        if (hours > 0) durationText += `${hours}h `;
        durationText += `${mins}m`;
        durationSpan.textContent = durationText;
        
        header.appendChild(timeSpan);
        header.appendChild(durationSpan);
        routeElement.appendChild(header);
        
        // Route transfers info
        const transfersDiv = document.createElement('div');
        transfersDiv.classList.add('route-transfers');
        
        if (route.type === 'direct') {
            transfersDiv.textContent = 'Direct route';
        } else {
            transfersDiv.innerHTML = `Transfer at <strong>${route.transferStop.stop_name}</strong> (${route.transferTime} min)`;
        }
        
        routeElement.appendChild(transfersDiv);
        
        // Route segments
        const segmentsDiv = document.createElement('div');
        segmentsDiv.classList.add('route-segments');
        
        route.segments.forEach(segment => {
            const segmentDiv = document.createElement('div');
            segmentDiv.classList.add('route-segment');
            
            const routeLine = document.createElement('div');
            routeLine.classList.add('route-line');
            routeLine.textContent = segment.route.route_short_name;
            routeLine.style.backgroundColor = `#${segment.route.route_color || '000000'}`;
            routeLine.style.color = `#${segment.route.route_text_color || 'FFFFFF'}`;
            
            const segmentText = document.createElement('div');
            segmentText.innerHTML = `${formatMinutesToTime(segment.departureTime)} from <strong>${segment.fromStop.stop_name}</strong> to <strong>${segment.toStop.stop_name}</strong>`;
            
            segmentDiv.appendChild(routeLine);
            segmentDiv.appendChild(segmentText);
            segmentsDiv.appendChild(segmentDiv);
        });
        
        routeElement.appendChild(segmentsDiv);
        
        // Add click event to show route on map
        routeElement.addEventListener('click', () => {
            // Highlight selected route
            document.querySelectorAll('.route-option').forEach(el => el.classList.remove('selected'));
            routeElement.classList.add('selected');
            
            // Display route on map
            displayRouteOnMap(route);
        });
        
        routeList.appendChild(routeElement);
        
        // Display the first route on map by default
        if (index === 0) {
            displayRouteOnMap(route);
        }
    });
}

// Display a route on the map
function displayRouteOnMap(route) {
    // Clear previous route lines
    routeLines.forEach(line => map.removeLayer(line));
    routeLines = [];
    
    // Reset marker colors
    stopMarkers.forEach(markerObj => {
        if (markerObj.stop.stop_id === selectedFromStop.stop_id) {
            markerObj.marker.setStyle({ fillColor: "#00ff00" });
        } else if (markerObj.stop.stop_id === selectedToStop.stop_id) {
            markerObj.marker.setStyle({ fillColor: "#ff0000" });
        } else if (route.type === 'transfer' && markerObj.stop.stop_id === route.transferStop.stop_id) {
            markerObj.marker.setStyle({ fillColor: "#ffcc00" });
        } else {
            markerObj.marker.setStyle({ fillColor: "#3388ff" });
        }
    });
    
    // Draw route segments
    route.segments.forEach(segment => {
        // Create markers for all stops in this segment
        segment.segmentStops.forEach(stopTime => {
            const stop = gtfsData.stops.find(s => s.stop_id === stopTime.stop_id);
            if (!stop) return;
            
            // Find marker
            const marker = findMarkerByStop({ stop_id: stop.stop_id });
            if (marker) {
                // Make stop markers more visible along the route
                marker.setRadius(6);
                marker.setStyle({ opacity: 1, fillOpacity: 1 });
            }
        });
        
        // Try to find a shape for this trip
        const tripShape = gtfsData.trips.find(t => t.trip_id === segment.trip.trip_id)?.shape_id;
        
        if (tripShape) {
            // Get shape points
            const shapePoints = gtfsData.shapes
                .filter(s => s.shape_id === tripShape)
                .sort((a, b) => parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence))
                .map(s => [parseFloat(s.shape_pt_lat), parseFloat(s.shape_pt_lon)]);
            
            if (shapePoints.length > 0) {
                const routeLine = L.polyline(shapePoints, {
                    color: `#${segment.route.route_color || '000000'}`,
                    weight: 5,
                    opacity: 0.7
                }).addTo(map);
                
                routeLines.push(routeLine);
                
                // For simplicity, fit map bounds to the first segment only
                if (route.segments.indexOf(segment) === 0) {
                    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
                }
            }
        } else {
            // If no shape available, just connect the stops
            const stopCoordinates = segment.segmentStops.map(stopTime => {
                const stop = gtfsData.stops.find(s => s.stop_id === stopTime.stop_id);
                return [parseFloat(stop.stop_lat), parseFloat(stop.stop_lon)];
            });
            
            if (stopCoordinates.length > 1) {
                const routeLine = L.polyline(stopCoordinates, {
                    color: `#${segment.route.route_color || '000000'}`,
                    weight: 5,
                    opacity: 0.7,
                    dashArray: '5, 10' // Dashed line to indicate approximate path
                }).addTo(map);
                
                routeLines.push(routeLine);
                
                // For simplicity, fit map bounds to the first segment only
                if (route.segments.indexOf(segment) === 0) {
                    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
                }
            }
        }
    });
    
    // Make sure origin and destination are visible
    const bounds = L.latLngBounds([
        [selectedFromStop.stop_lat, selectedFromStop.stop_lon],
        [selectedToStop.stop_lat, selectedToStop.stop_lon]
    ]);
    
    if (route.type === 'transfer') {
        bounds.extend([route.transferStop.stop_lat, route.transferStop.stop_lon]);
    }
    
    map.fitBounds(bounds, { padding: [50, 50] });
}

// Initialize the app when DOM is loaded
function initApp() {
    // Set current date and time
    const now = new Date();
    dateSelect.value = formatDate(now);
    timeSelect.value = formatTime(now);
    
    // Setup event listeners
    fromStopInput.addEventListener('input', () => showSuggestions(fromStopInput, fromSuggestions, 'from'));
    toStopInput.addEventListener('input', () => showSuggestions(toStopInput, toSuggestions, 'to'));
    searchButton.addEventListener('click', findRoutes);
    
    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!fromStopInput.contains(e.target) && !fromSuggestions.contains(e.target)) {
            fromSuggestions.style.display = 'none';
        }
        if (!toStopInput.contains(e.target) && !toSuggestions.contains(e.target)) {
            toSuggestions.style.display = 'none';
        }
    });
    
    // Update current time display
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    // Load all stops to map
    loadStopsToMap();
}