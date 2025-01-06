import fs from "fs/promises";
import path from "path";

export class SwaggerMerger {
    constructor() {}

    /**
     * Reads JSON files, merges them, and writes the result to a new file
     */
    public async mergeFiles(originalPath: string, modifiedPath: string, outputPath: string): Promise<void> {
        try {
            const originalContent = await fs.readFile(originalPath, "utf8");
            const modifiedContent = await fs.readFile(modifiedPath, "utf8");

            const originalJson = JSON.parse(originalContent);
            const modifiedJson = JSON.parse(modifiedContent);

            const mergedJson = this.mergeSwaggerJson(originalJson, modifiedJson);

            const outputDir = path.dirname(outputPath);
            await fs.mkdir(outputDir, { recursive: true });

            await fs.writeFile(outputPath, JSON.stringify(mergedJson, null, 4));
            console.log("Successfully merged JSON files!", outputPath);
        } catch (error) {
            console.error("Error merging files:", error);
            throw error;
        }
    }

    /**
     * Merges modified Swagger JSON content into original JSON while preserving extra content
     */
    private mergeSwaggerJson(original: any, modified: any): any {
        const originalRootId = original._id;

        // Helper function to find an item by ID in an array
        const findByUrl = (array: any[], item: any): any | undefined => {
            if (item.url !== undefined && item.method !== undefined) {
                return array.find(
                    (arrayItem) => arrayItem.method === item.method && arrayItem.url === item.url
                );
            }
            return array.find((arrayItem) => arrayItem.name === item.name);
        };

        const deepMerge = (orig: any, mod: any): any => {
            const result: any = { ...orig };
            const isRequest = "url" in mod || "body" in mod || "modified" in mod;

            for (const key in mod) {
                if (isRequest && (key === "url" || key === "body" || key === "modified")) {
                    result[key] = mod[key];
                } else if (Array.isArray(mod[key])) {
                    if (key === "folders" || key === "requests") {
                        result[key] = mergeContainers(orig[key] || [], mod[key]);
                    } else {
                        result[key] = concatenateUniqueItems(orig[key] || [], mod[key]);
                    }
                } else if (typeof mod[key] === "object" && mod[key] !== null) {
                    result[key] = deepMerge(orig[key] || {}, mod[key]);
                } else {
                    result[key] = orig[key] !== undefined ? orig[key] : mod[key];
                }
            }
            return result;
        };

        const findFolderById = (folders: any[], id: string): any | undefined =>
            folders.find((f) => f._id === id);

        const findFolderIdByName = (folders: any[], name: string): string | undefined => {
            const folder = folders.find((f) => f.name === name);
            return folder?._id;
        };

        const mergeContainers = (origContainers: any[], modContainers: any[]): any[] => {
            const result: any[] = [...origContainers];
            modContainers.forEach((modItem) => {
                const existingItem = findByUrl(result, modItem);
                const isRequest = modItem.url !== undefined || modItem.method !== undefined;

                if (existingItem) {
                    Object.assign(existingItem, deepMerge(existingItem, modItem));
                    if (isRequest) {
                        existingItem.colId = originalRootId;
                    }
                } else {
                    let finalContainerId = modItem.containerId;
                    if (modItem.containerId) {
                        const modifiedParentFolder = findFolderById(modified.folders || [], modItem.containerId);
                        if (modifiedParentFolder) {
                            const originalFolderId = findFolderIdByName(original.folders || [], modifiedParentFolder.name);
                            if (originalFolderId) {
                                finalContainerId = originalFolderId;
                            }
                        }
                    }
                    result.push({
                        ...modItem,
                        ...(isRequest
                            ? { colId: originalRootId, containerId: finalContainerId }
                            : { containerId: finalContainerId }),
                    });
                }
            });
            result.sort((a, b) => (a.sortNum || 0) - (b.sortNum || 0));
            return result;
        };

        const concatenateUniqueItems = (origItems: any[], modItems: any[]): any[] => {
            const result: any[] = [...origItems];
            modItems.forEach((modItem) => {
                const isUnique = !result.some((existingItem) => areItemsEqual(modItem, existingItem));
                if (isUnique) {
                    result.push(modItem);
                }
            });
            return result;
        };

        const areItemsEqual = (item1: any, item2: any): boolean => {
            if (item1.name && item2.name && item1.name === item2.name) {
                return item1.isPath === undefined || item1.isPath === item2.isPath;
            } else {
                return item1.name && item2.name && item1.name === item2.name;
            }
        };

        // Start the merge
        const mergedResult: any = deepMerge(original, modified);

        // Preserve root properties
        mergedResult._id = original._id;
        mergedResult.colId = original.colId;
        mergedResult.containerId = original.containerId;
        mergedResult.colName = original.colName;
        mergedResult.created = original.created;
        mergedResult.settings = {
            ...original.settings,
        };

        return mergedResult;
    }

    /**
     * Remove items that exist in original but not in updated
     */
    private deleteItemsFromOriginalJson(original: any, modified: any): any {
        const result = { ...original };
        const normalizeUrl = (url: string): string => {
            return url.split("?")[0].replace(/\/+$/, "");
        };

        const itemExistsInModified = (item: any, modifiedArray: any[]): boolean => {
            if (item.url && item.method) {
                return modifiedArray.some(
                    (modItem) =>
                        modItem.method === item.method &&
                        normalizeUrl(modItem.url) === normalizeUrl(item.url)
                );
            }
            return modifiedArray.some((modItem) => modItem.name === item.name);
        };

        // Process folders
        if (result.folders) {
            result.folders = result.folders.filter((folder: any) =>
                itemExistsInModified(folder, modified.folders || [])
            );
        }

        // Process requests
        if (result.requests) {
            result.requests = result.requests.filter((request: any) =>
                itemExistsInModified(request, modified.requests || [])
            );
        }

        // Handle nested folders recursively
        const processNestedFolders = (folders: any[]): any[] => {
            return folders.map((folder) => {
                if (folder.folders) {
                    folder.folders = processNestedFolders(folder.folders);
                }
                if (folder.requests) {
                    folder.requests = folder.requests.filter((request: any) =>
                        itemExistsInModified(request, modified.requests || [])
                    );
                }
                return folder;
            });
        };

        if (result.folders) {
            result.folders = processNestedFolders(result.folders);
        }

        return result;
    }
}