// src/modules/analytics.js

/**
 * Analytics Helper Functions
 */

/**
 * Track an event in the analytics system
 * @param {string} event - Name of the event to track
 * @param {Object} data - Additional data related to the event
 * @returns {void}
 */
function trackEvent(event, data) {
    if (!event) {
        console.error('Event name is required');
        return;
    }
    
    // Assume there's a sendAnalytics function to send data to the server
    sendAnalytics({ event, ...data });
}

/**
 * Calculate average
 * @param {Array<number>} values - Array of numbers to calculate average
 * @returns {number} - The average value
 */
function calculateAverage(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return 0; // Return 0 for empty array or invalid input
    }
    
    const total = values.reduce((sum, value) => sum + value, 0);
    return total / values.length;
}

/**
 * Log error to the analytics service
 * @param {string} errorMessage - The error message to log
 * @returns {void}
 */
function logError(errorMessage) {
    if (!errorMessage) {
        console.error('Error message is required');
        return;
    }
    
    // Assume there's an error logging service
    sendErrorLog({ error: errorMessage });
}

export { trackEvent, calculateAverage, logError };