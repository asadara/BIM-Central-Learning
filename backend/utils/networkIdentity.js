const PRIVATE_IPV4_PATTERNS = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./
];

const VIRTUAL_INTERFACE_PATTERN = /(vEthernet|Hyper-V|WSL|Loopback|VirtualBox|VMware|Docker|ZeroTier|Tailscale|Npcap)/i;

function isPrivateIPv4(address) {
    return typeof address === "string" && PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(address));
}

function isVirtualInterfaceName(name) {
    return typeof name === "string" && VIRTUAL_INTERFACE_PATTERN.test(name);
}

function collectServerIPv4s(networkInterfaces) {
    const entries = [];

    for (const [name, interfaces] of Object.entries(networkInterfaces || {})) {
        for (const iface of interfaces || []) {
            if (iface?.family !== "IPv4" || iface.internal || !iface.address) {
                continue;
            }

            entries.push({
                name,
                address: iface.address,
                isPrivate: isPrivateIPv4(iface.address),
                isVirtual: isVirtualInterfaceName(name)
            });
        }
    }

    const ordered = [
        ...entries.filter((entry) => entry.isPrivate && !entry.isVirtual),
        ...entries.filter((entry) => !entry.isPrivate && !entry.isVirtual),
        ...entries.filter((entry) => entry.isPrivate && entry.isVirtual),
        ...entries.filter((entry) => !entry.isPrivate && entry.isVirtual)
    ];

    return [...new Set(ordered.map((entry) => entry.address))];
}

function getPreferredServerIPv4(networkInterfaces) {
    return collectServerIPv4s(networkInterfaces)[0] || "localhost";
}

module.exports = {
    collectServerIPv4s,
    getPreferredServerIPv4,
    isPrivateIPv4,
    isVirtualInterfaceName
};
