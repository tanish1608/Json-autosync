import fs from 'fs/promises';
import path from 'path';
/**
 * Merges modified Swagger JSON content into original JSON while preserving extra content
 * @param {object} original - Original JSON object
 * @param {object} modified - Modified JSON object
 * @returns {object} - Merged JSON object
 */
function mergeSwaggerJSON(original, modified) {
    // Helper function to find an item by ID in an array
    const findById = (array, name) => array.find(item => item.name === name);
    // Deep merge function for non-array objects
    const deepMerge = (orig, mod) => {
        const result = { ...orig };
        for (const key in mod) {
            if (Array.isArray(mod[key])) {
                // Handle arrays (folders, requests, params, headers, etc.) specially
                if (key === 'folders' || key === 'requests') {
                    result[key] = mergeContainers(orig[key] || [], mod[key]);
                }
                else {
                    // Concatenate other arrays (e.g., params, headers, body)
                    result[key] = concatenateUniqueItems(orig[key] || [], mod[key]);
                }
            }
            else if (typeof mod[key] === 'object' && mod[key] !== null) {
                result[key] = deepMerge(orig[key] || {}, mod[key]);
            }
            else {
                // Handle conflicts (here: prefer original)
                result[key] = orig[key] !== undefined ? orig[key] : mod[key];
            }
        }
        return result;
    };
    // Merge containers (folders or requests) while preserving IDs and extra content
    const mergeContainers = (origContainers, modContainers) => {
        const result = [...origContainers];
        modContainers.forEach(modItem => {
            const existingItem = findById(result, modItem.name);
            if (existingItem) {
                // Merge existing item with modified item, preserving original IDs
                Object.assign(existingItem, deepMerge(existingItem, modItem));
            }
            else {
                // Add new item (without modification)
                result.push({ ...modItem });
            }
        });
        // Sort by sortNum after merging
        result.sort((a, b) => (a.sortNum || 0) - (b.sortNum || 0));
        return result;
    };
    // Concatenate arrays by adding unique items based on a combination of properties
    const concatenateUniqueItems = (origItems, modItems) => {
        const result = [...origItems]; // Start with a copy of original items
        modItems.forEach(modItem => {
            // Check if the modItem is unique compared to the current result array
            const isUnique = !result.some(existingItem => areItemsEqual(modItem, existingItem));
            if (isUnique) {
                result.push(modItem); // Add to the result if it's unique
            }
        });
        return result;
    };
    // Helper function to compare items for equality based on relevant properties
    const areItemsEqual = (item1, item2) => {
        if (item1.name && item2.name && item1.name === item2.name) {
            // For params, also check isPath
            return item1.isPath === undefined || item1.isPath === item2.isPath;
        }
        else {
            // For other items (e.g., headers), just check the name
            return item1.name && item2.name && item1.name === item2.name;
        }
    };
    // Start the merge process
    const merged = deepMerge(original, modified);
    // Ensure important root properties are preserved
    merged._id = original._id;
    merged.colId = original.colId;
    merged.containerId = original.containerId;
    merged.colName = original.colName;
    merged.created = original.created;
    // Merge settings
    merged.settings = {
        ...original.settings,
    };
    return merged;
}
/**
 * Reads JSON files, merges them, and writes the result to a new file
 * @param {string} originalPath - Path to original JSON file
 * @param {string} modifiedPath - Path to modified JSON file
 * @param {string} outputPath - Path where merged JSON will be written
 */
async function mergeSwaggerFiles(originalPath, modifiedPath, outputPath) {
    try {
        // Read both JSON files
        const originalContent = await fs.readFile(originalPath, 'utf8');
        const modifiedContent = await fs.readFile(modifiedPath, 'utf8');
        // Parse JSON content
        const original = JSON.parse(originalContent);
        const modified = JSON.parse(modifiedContent);
        // Merge the JSONs
        const merged = mergeSwaggerJSON(original, modified);
        // Create output directory if it doesn't exist
        const outputDir = path.dirname(outputPath);
        await fs.mkdir(outputDir, { recursive: true });
        // Write merged content to new file with pretty formatting
        await fs.writeFile(outputPath, JSON.stringify(merged, null, 4));
        console.log('Successfully merged JSON files!');
        console.log('Output written to:', outputPath);
    }
    catch (error) {
        console.error('Error during file operations:', error);
        throw error;
    }
}
// Example usage (make sure the files exist in the correct paths)
const originalPath = 'Json/Original-petstore.json';
const modifiedPath = 'Json/Updated-petstore.json';
const outputPath = 'Json/Merged-petstore-ts.json';
mergeSwaggerFiles(originalPath, modifiedPath, outputPath)
    .catch(error => {
    console.error('Failed to merge Swagger files:', error);
    process.exit(1);
});
