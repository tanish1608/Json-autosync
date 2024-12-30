# JSON Merger

This tool merges two Swagger/OpenAPI specification JSON files, typically representing an "original" and a "Updated" version of a specification. The primary goal is to facilitate an update process where changes (modifications, additions) from the Updated specification are incorporated into the original specification while preserving the original structure, IDs, and certain properties as much as possible.

To Run: 
```
npx ts-node json-merger-final-typescript.ts          

```

## Features

*   **Preserves form Original Json:** Existing folders, requests, and other items in the original Json retain their original IDs, ColName, Created, SortNum, etc  in the merged output.
*   **Preserves from Updated Josn:** The Url, Body, Modified tags in Request are unmodified and put as is into merged output from Updated Json.
*   **Adds New Items:** New folders, requests, parameters, headers, etc., that are present in the Updated specification but not in the original are added to the merged output.
*   **Concatenates Unique Items:** For arrays like `params`, `headers`, and `body`, the tool concatenates unique items from the Updated specification into the corresponding arrays in the original, preventing duplicates based on relevant properties (e.g., `name` and `isPath` for parameters).
*   **Deep Merging:** Nested objects within folders, requests, and other items are recursively merged.
*   **Prefers Original Settings:** The `settings` object from the original specification is used in the merged output, discarding any settings from the Updated specification.
*   **Handles Missing Properties:** Correctly handles cases where certain properties (e.g., `name`, `isPath`) might be `undefined` or `null` in either the original or Updated specification.
*   **Preserves Extra Properties:** Any non-standard or extra properties present in the original specification are retained in the merged output.
*   **Sorts Folders and Requests:** Folders and requests in the merged output are sorted based on their `sortNum` property.



