const fs = require('fs');
const path = require('path');

const modulesPath = path.join(__dirname, '../data/modules.json');

exports.getModules = (req, res) => {
    const modules = JSON.parse(fs.readFileSync(modulesPath));
    res.json(modules);
};

exports.getModuleById = (req, res) => {
    const modules = JSON.parse(fs.readFileSync(modulesPath));
    const module = modules.find(m => m.id === req.params.id);
    if (!module) return res.status(404).json({ error: 'Module not found' });
    res.json(module);
};
