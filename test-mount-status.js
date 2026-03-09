const LANMountManager = require('./backend/utils/lanMountManager');
const lanManager = new LANMountManager();
const mount = lanManager.getMountById('pc-bim02');
console.log('Current PC-BIM02 mount status:', mount ? mount.status : 'Mount not found');
console.log('Mount config:', JSON.stringify(mount, null, 2));
