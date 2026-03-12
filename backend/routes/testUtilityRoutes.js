const express = require("express");
const fs = require("fs");
const path = require("path");

function createTestUtilityRoutes() {
    const router = express.Router();

    router.get("/api/test/pc-bim02-direct", (req, res) => {
        console.log("ðŸ§ª PC-BIM02 Direct Test Endpoint Called");

        const pcBim02UncPath = "\\\\10.0.0.122\\PROJECT BIM 2025";

        try {
            console.log(`Testing direct access to: ${pcBim02UncPath}`);

            const pathExists = fs.existsSync(pcBim02UncPath);
            console.log(`Path exists: ${pathExists}`);

            if (!pathExists) {
                return res.json({
                    success: false,
                    error: "PC-BIM02 UNC path does not exist",
                    path: pcBim02UncPath
                });
            }

            const stats = fs.statSync(pcBim02UncPath);
            const isDirectory = stats.isDirectory();
            console.log(`Is directory: ${isDirectory}`);

            if (!isDirectory) {
                return res.json({
                    success: false,
                    error: "PC-BIM02 UNC path is not a directory",
                    path: pcBim02UncPath
                });
            }

            const items = fs.readdirSync(pcBim02UncPath, { withFileTypes: true });
            console.log(`Found ${items.length} items`);

            const projectFolders = items.filter((item) => item.isDirectory());
            console.log(`Found ${projectFolders.length} project folders`);

            let firstProjectDetails = null;
            if (projectFolders.length > 0) {
                const firstProject = projectFolders[0];
                const projectPath = path.join(pcBim02UncPath, firstProject.name);

                try {
                    const projectItems = fs.readdirSync(projectPath, { withFileTypes: true });
                    firstProjectDetails = {
                        name: firstProject.name,
                        path: projectPath,
                        itemCount: projectItems.length,
                        items: projectItems.slice(0, 5).map((item) => ({
                            name: item.name,
                            type: item.isDirectory() ? "directory" : "file"
                        }))
                    };
                    console.log(`Successfully accessed first project: ${firstProject.name}`);
                } catch (projectError) {
                    console.log(`Failed to access first project: ${projectError.message}`);
                    firstProjectDetails = {
                        name: firstProject.name,
                        error: projectError.message
                    };
                }
            }

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                uncPath: pcBim02UncPath,
                tests: {
                    pathExists,
                    isDirectory,
                    itemCount: items.length,
                    projectFolderCount: projectFolders.length
                },
                projects: projectFolders.slice(0, 10).map((folder) => folder.name),
                firstProjectDetails,
                message: "PC-BIM02 direct access test completed successfully"
            });
        } catch (error) {
            console.error("PC-BIM02 direct test failed:", error);
            res.status(500).json({
                success: false,
                error: error.message,
                code: error.code,
                path: pcBim02UncPath
            });
        }
    });

    return router;
}

module.exports = createTestUtilityRoutes;
