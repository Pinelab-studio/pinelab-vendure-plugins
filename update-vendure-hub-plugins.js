/**
 * This script creates or updates all plugins in this repository on the Vendure Hub (https://hub.vendure.io/admin/)
 *
 * 1. Find all plugins that contain `pinelab` in the `repositoryUrl`
 * 2. Update names and descriptions of all plugins in this repository that have a corresponding entry in the Vendure Hub
 * 3. Create new entries for plugins that do not yet exist in the Vendure Hub
 * 4. List all plugins with `pinelab` but no matching entry in the Vendure Hub in the console. These should be deleted manually
 *
 */
