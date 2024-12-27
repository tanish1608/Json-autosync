import fs from 'fs/promises';
import path from 'path';

/**
 * Merges modified Swagger JSON content into original JSON while preserving extra content
 * @param {Object} original - Original JSON object
 * @param {Object} modified - Modified JSON object
 * @returns {Object} - Merged JSON object
 */

function mergeSwaggerJSON(original, modified) {
    // Helper function to find an item by name in an array
    const findById = (array, name) => array.find(item => item.name === name);

    // Deep merge function for non-array objects
    const deepMerge = (orig, mod) => {
        const result = { ...orig };
        
        for (const key in mod) {
            if (Array.isArray(mod[key])) {
                // Handle arrays (folders and requests) specially
                if (key === 'folders' || key === 'requests') {
                    result[key] = mergeContainers(orig[key] || [], mod[key]);
                } else {
                    result[key] = [...(orig[key] || []), ...mod[key]];
                }
            } else if (typeof mod[key] === 'object' && mod[key] !== null) {
                result[key] = deepMerge(orig[key] || {}, mod[key]);
            } else {
                // If the key already exists in original and is not an array or object, concatenate the values
                if (orig[key] && typeof orig[key] === 'string' && typeof mod[key] === 'string') {
                    result[key] = orig[key] + mod[key];
                } else {
                    result[key] = mod[key];
                }
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
                // Merge existing item with modified item
                Object.assign(existingItem, {
                    ...existingItem,
                    ...modItem,
                    // Preserve any extra properties from original
                    ...Object.fromEntries(
                        Object.entries(existingItem).filter(([key]) => !(key in modItem))
                    )
                });

                // Handle nested folders
                if (modItem.containerId) {
                    existingItem.containerId = modItem.containerId;
                }
            } else {
                // Add new item
                result.push({ ...modItem });
            }
        });
        
        return result;
    };

    // Start the merge process
    const merged = deepMerge(original, modified);
    
    // Ensure important root properties are preserved
    merged._id = original._id;
    merged.colId = original.colId;
    merged.containerId = original.containerId;
    merged.colName = modified.colName;
    merged.created = original.created;
    
    // Merge settings
    merged.settings = {
        ...original.settings,
        ...modified.settings
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

    } catch (error) {
        console.error('Error during file operations:', error);
        throw error;
    }
}

// Example usage
const originalPath = 'Swagger-sync/tc_col_swagger-petstore-original.json';
const modifiedPath = 'Swagger-sync/tc_col_swagger-petstore-openapi-3.0-Modified.json';
const outputPath = 'merged-swagger-spec.json';

mergeSwaggerFiles(originalPath, modifiedPath, outputPath)
    .catch(error => {
        console.error('Failed to merge Swagger files:', error);
        process.exit(1);
    });