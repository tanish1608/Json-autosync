import { SwaggerMerger } from './JsonMerger';

(async () => {
    const merger = new SwaggerMerger();
    try {
        await merger.mergeFiles(
            "Json/Original-petstore.json",  // Original Json path
            "Json/Updated-petstore.json",   // Updated Json path
            "Json/Merged-petstore.json"     // Merged Json path
        );
    } catch (error) {
        console.error("Merge failed:", error);
        process.exit(1);
    }
})();