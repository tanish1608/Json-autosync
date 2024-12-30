import fs from 'fs/promises';
import path from 'path';

/**
 * Merges modified Swagger JSON content into original JSON while preserving extra content
 * @param {object} original - Original JSON object
 * @param {object} modified - Modified JSON object
 * @returns {object} - Merged JSON object
 */

function mergeSwaggerJSON(original: any, modified: any): any {
    const originalRootId = original._id;

    // Helper function to find an item by ID in an array
    const findById = (array: any[], name: string): any | undefined => array.find(item => item.name === name);

    // Deep merge function for non-array objects
    const deepMerge = (orig: any, mod: any): any => {
        const result: any = { ...orig };
    
        // Check if this is a request object (has url or body)
        const isRequest = 'url' in mod || 'body' in mod || 'modified' in mod;
        
        for (const key in mod) {
            if (isRequest && (key === 'url' || key === 'body' || key === 'modified')) {
                // Always use modified url and body for requests
                result[key] = mod[key];
            }
            else if (Array.isArray(mod[key])) {
                if (key === 'folders' || key === 'requests') {
                    result[key] = mergeContainers(orig[key] || [], mod[key]);
                } else {
                    result[key] = concatenateUniqueItems(orig[key] || [], mod[key]);
                }
            } else if (typeof mod[key] === 'object' && mod[key] !== null) {
                result[key] = deepMerge(orig[key] || {}, mod[key]);
            } else {
                result[key] = orig[key] !== undefined ? orig[key] : mod[key];
            }
        }
    
        return result;
    };
    // Add these helper functions
    const findFolderById = (folders: any[], id: string): any | undefined => 
        folders.find(f => f._id === id);

    const findFolderIdByName = (folders: any[], name: string): string | undefined => {
        const folder = folders.find(f => f.name === name);
        return folder?._id;
    };


    // Merge containers (folders or requests) while preserving IDs and extra content
    const mergeContainers = (origContainers: any[], modContainers: any[]): any[] => {
        const result: any[] = [...origContainers];

        modContainers.forEach(modItem => {
            const existingItem = findById(result, modItem.name);
            const isRequest = modItem.url !== undefined || modItem.method !== undefined;

            if (existingItem) {
                // Merge existing item with modified item, preserving original IDs
                Object.assign(existingItem, deepMerge(existingItem, modItem));
                if (isRequest) {
                    existingItem.colId = originalRootId;
                }
            } else {
                let finalContainerId = modItem.containerId;

            // Handle container ID mapping for both requests and folders
            if (modItem.containerId) {
                // Find parent folder in modified JSON
                const modifiedParentFolder = findFolderById(modified.folders || [], modItem.containerId);
                if (modifiedParentFolder) {
                    // Try to find matching folder in original JSON
                    const originalFolderId = findFolderIdByName(original.folders || [], modifiedParentFolder.name);
                    if (originalFolderId) {
                        finalContainerId = originalFolderId;
                    }
                }
            }

            // Add new item with mapped container ID
            result.push({
                ...modItem,
                ...(isRequest ? { 
                    colId: originalRootId,
                    containerId: finalContainerId 
                } : {
                    containerId: finalContainerId
                })
            });
        }
    });

        // Sort by sortNum after merging
        result.sort((a, b) => (a.sortNum || 0) - (b.sortNum || 0));

        return result;
    };

    // Concatenate arrays by adding unique items based on a combination of properties
    const concatenateUniqueItems = (origItems: any[], modItems: any[]): any[] => {
        const result: any[] = [...origItems]; // Start with a copy of original items

        modItems.forEach(modItem => {
            // Check if the modItem is unique compared to the current result array
            const isUnique: boolean = !result.some(existingItem => areItemsEqual(modItem, existingItem));

            if (isUnique) {
                result.push(modItem); // Add to the result if it's unique
            }
        });

        return result;
    };

    // Helper function to compare items for equality based on relevant properties
    const areItemsEqual = (item1: any, item2: any): boolean => {
        if (item1.name && item2.name && item1.name === item2.name) {
            // For params, also check isPath
            return item1.isPath === undefined || item1.isPath === item2.isPath;
        } else {
            // For other items (e.g., headers), just check the name
            return item1.name && item2.name && item1.name === item2.name;
        }
    };

    // Start the merge process
    const merged: any = deepMerge(original, modified);

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
async function mergeSwaggerFiles(originalPath: string, modifiedPath: string, outputPath: string): Promise<void> {
    try {
        // Read both JSON files
        const originalContent: string = await fs.readFile(originalPath, 'utf8');
        const modifiedContent: string = await fs.readFile(modifiedPath, 'utf8');

        // Parse JSON content
        const original: any = JSON.parse(originalContent);
        const modified: any = JSON.parse(modifiedContent);

        // Merge the JSONs
        const merged: any = mergeSwaggerJSON(original, modified);

        // Create output directory if it doesn't exist
        const outputDir: string = path.dirname(outputPath);
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

const originalPath: string = 'Json/Original-petstore.json';
const modifiedPath: string = 'Json/Updated-petstore.json';
const outputPath: string = 'Json/Merged-petstore.json';

mergeSwaggerFiles(originalPath, modifiedPath, outputPath)
    .catch(error => {
        console.error('Failed to merge Swagger files:', error);
        process.exit(1);
    });