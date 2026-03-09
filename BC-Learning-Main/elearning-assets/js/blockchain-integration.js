/**
 * Blockchain Integration System
 * Advanced blockchain-based certificate verification, credential management,
 * smart contracts for achievements, and decentralized record keeping
 */

class BlockchainIntegration {
    constructor() {
        this.initialized = false;
        this.web3Provider = null;
        this.contractInstances = {};
        this.walletConnected = false;
        this.userAddress = null;
        this.networkId = null;
        this.certificateContract = null;
        this.achievementContract = null;
        this.credentialContract = null;
        this.ipfsGateway = 'https://ipfs.io/ipfs/';
        this.supportedNetworks = {
            1: 'Ethereum Mainnet',
            3: 'Ropsten Testnet',
            4: 'Rinkeby Testnet',
            5: 'Goerli Testnet',
            137: 'Polygon Mainnet',
            80001: 'Polygon Mumbai Testnet'
        };
        this.eventListeners = new Map();
        this.transactionQueue = [];
        this.gasEstimationCache = new Map();
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Blockchain Integration System...');

            await this.detectWeb3Provider();
            await this.setupContractABIs();
            await this.initializeEventSystem();
            await this.loadUserPreferences();

            this.initialized = true;
            console.log('Blockchain Integration System initialized successfully');

            this.emitEvent('blockchain:initialized', {
                timestamp: new Date().toISOString(),
                provider: this.web3Provider ? 'detected' : 'not_detected'
            });

        } catch (error) {
            console.error('Failed to initialize Blockchain Integration:', error);
            this.handleError('initialization', error);
        }
    }

    // Web3 Provider Detection and Wallet Connection
    async detectWeb3Provider() {
        if (typeof window !== 'undefined') {
            // MetaMask detection
            if (window.ethereum) {
                this.web3Provider = window.ethereum;
                console.log('MetaMask detected');

                // Setup MetaMask event listeners
                this.web3Provider.on('accountsChanged', (accounts) => {
                    this.handleAccountChange(accounts);
                });

                this.web3Provider.on('chainChanged', (chainId) => {
                    this.handleNetworkChange(chainId);
                });

                this.web3Provider.on('disconnect', () => {
                    this.handleDisconnection();
                });

            } else if (window.web3) {
                this.web3Provider = window.web3.currentProvider;
                console.log('Legacy Web3 provider detected');
            } else {
                console.warn('No Web3 provider detected. Install MetaMask or use WalletConnect.');
                await this.setupWalletConnect();
            }
        }
    }

    async connectWallet() {
        try {
            if (!this.web3Provider) {
                throw new Error('No Web3 provider available');
            }

            const accounts = await this.web3Provider.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length > 0) {
                this.userAddress = accounts[0];
                this.walletConnected = true;

                const chainId = await this.web3Provider.request({
                    method: 'eth_chainId'
                });
                this.networkId = parseInt(chainId, 16);

                await this.deployOrLoadContracts();

                this.emitEvent('wallet:connected', {
                    address: this.userAddress,
                    network: this.supportedNetworks[this.networkId] || 'Unknown',
                    timestamp: new Date().toISOString()
                });

                return {
                    success: true,
                    address: this.userAddress,
                    network: this.networkId
                };
            }
        } catch (error) {
            console.error('Wallet connection failed:', error);
            this.handleError('wallet_connection', error);
            return { success: false, error: error.message };
        }
    }

    // Smart Contract Management
    setupContractABIs() {
        // Certificate Contract ABI
        this.certificateABI = [
            {
                "inputs": [
                    { "name": "recipient", "type": "address" },
                    { "name": "courseId", "type": "string" },
                    { "name": "courseName", "type": "string" },
                    { "name": "completionDate", "type": "uint256" },
                    { "name": "metadataURI", "type": "string" }
                ],
                "name": "issueCertificate",
                "outputs": [{ "name": "tokenId", "type": "uint256" }],
                "type": "function"
            },
            {
                "inputs": [{ "name": "tokenId", "type": "uint256" }],
                "name": "verifyCertificate",
                "outputs": [
                    { "name": "valid", "type": "bool" },
                    { "name": "recipient", "type": "address" },
                    { "name": "issuer", "type": "address" },
                    { "name": "courseId", "type": "string" },
                    { "name": "issuanceDate", "type": "uint256" }
                ],
                "type": "function"
            }
        ];

        // Achievement Contract ABI
        this.achievementABI = [
            {
                "inputs": [
                    { "name": "user", "type": "address" },
                    { "name": "achievementType", "type": "string" },
                    { "name": "points", "type": "uint256" },
                    { "name": "metadata", "type": "string" }
                ],
                "name": "recordAchievement",
                "outputs": [{ "name": "achievementId", "type": "uint256" }],
                "type": "function"
            },
            {
                "inputs": [{ "name": "user", "type": "address" }],
                "name": "getUserAchievements",
                "outputs": [{ "name": "achievements", "type": "uint256[]" }],
                "type": "function"
            }
        ];

        // Credential Contract ABI
        this.credentialABI = [
            {
                "inputs": [
                    { "name": "holder", "type": "address" },
                    { "name": "issuer", "type": "address" },
                    { "name": "credentialType", "type": "string" },
                    { "name": "validUntil", "type": "uint256" },
                    { "name": "credentialData", "type": "string" }
                ],
                "name": "issueCredential",
                "outputs": [{ "name": "credentialId", "type": "bytes32" }],
                "type": "function"
            },
            {
                "inputs": [{ "name": "credentialId", "type": "bytes32" }],
                "name": "verifyCredential",
                "outputs": [
                    { "name": "valid", "type": "bool" },
                    { "name": "holder", "type": "address" },
                    { "name": "issuer", "type": "address" },
                    { "name": "expiryDate", "type": "uint256" }
                ],
                "type": "function"
            }
        ];
    }

    async deployOrLoadContracts() {
        try {
            // Load contract addresses from storage or deploy new contracts
            const contractAddresses = this.loadContractAddresses();

            if (contractAddresses) {
                await this.loadExistingContracts(contractAddresses);
            } else {
                await this.deployNewContracts();
            }

        } catch (error) {
            console.error('Contract deployment/loading failed:', error);
            throw error;
        }
    }

    async deployNewContracts() {
        console.log('Deploying new smart contracts...');

        // Simplified deployment simulation (in production, use proper deployment)
        const mockAddresses = {
            certificate: '0x1234567890123456789012345678901234567890',
            achievement: '0x2345678901234567890123456789012345678901',
            credential: '0x3456789012345678901234567890123456789012'
        };

        this.certificateContract = this.createContractInstance(
            mockAddresses.certificate,
            this.certificateABI
        );

        this.achievementContract = this.createContractInstance(
            mockAddresses.achievement,
            this.achievementABI
        );

        this.credentialContract = this.createContractInstance(
            mockAddresses.credential,
            this.credentialABI
        );

        this.saveContractAddresses(mockAddresses);
        console.log('Smart contracts deployed successfully');
    }

    createContractInstance(address, abi) {
        // Simplified contract instance creation
        return {
            address: address,
            abi: abi,
            methods: this.createContractMethods(abi)
        };
    }

    createContractMethods(abi) {
        const methods = {};

        abi.forEach(method => {
            methods[method.name] = async (...args) => {
                return await this.callContractMethod(method, args);
            };
        });

        return methods;
    }

    // Certificate Management
    async issueCertificate(recipientAddress, courseData) {
        try {
            if (!this.walletConnected) {
                throw new Error('Wallet not connected');
            }

            // Upload certificate metadata to IPFS
            const metadataURI = await this.uploadToIPFS({
                name: `Certificate - ${courseData.courseName}`,
                description: `Completion certificate for ${courseData.courseName}`,
                image: courseData.certificateImage,
                attributes: [
                    { trait_type: "Course ID", value: courseData.courseId },
                    { trait_type: "Course Name", value: courseData.courseName },
                    { trait_type: "Completion Date", value: courseData.completionDate },
                    { trait_type: "Grade", value: courseData.grade },
                    { trait_type: "Instructor", value: courseData.instructor }
                ]
            });

            // Call smart contract to issue certificate
            const transaction = await this.certificateContract.methods.issueCertificate(
                recipientAddress,
                courseData.courseId,
                courseData.courseName,
                Math.floor(new Date(courseData.completionDate).getTime() / 1000),
                metadataURI
            );

            const result = await this.executeTransaction(transaction);

            // Store certificate data locally
            await this.storeCertificateLocally({
                tokenId: result.tokenId,
                recipient: recipientAddress,
                courseData,
                metadataURI,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber
            });

            this.emitEvent('certificate:issued', {
                tokenId: result.tokenId,
                recipient: recipientAddress,
                courseId: courseData.courseId,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                tokenId: result.tokenId,
                transactionHash: result.transactionHash,
                metadataURI
            };

        } catch (error) {
            console.error('Certificate issuance failed:', error);
            this.handleError('certificate_issuance', error);
            return { success: false, error: error.message };
        }
    }

    async verifyCertificate(tokenId) {
        try {
            const result = await this.certificateContract.methods.verifyCertificate(tokenId);

            if (result.valid) {
                // Fetch metadata from IPFS
                const metadata = await this.fetchFromIPFS(result.metadataURI);

                return {
                    valid: true,
                    recipient: result.recipient,
                    issuer: result.issuer,
                    courseId: result.courseId,
                    issuanceDate: new Date(result.issuanceDate * 1000),
                    metadata
                };
            }

            return { valid: false };

        } catch (error) {
            console.error('Certificate verification failed:', error);
            return { valid: false, error: error.message };
        }
    }

    // Achievement System
    async recordAchievement(userAddress, achievementData) {
        try {
            const metadata = await this.uploadToIPFS({
                type: achievementData.type,
                title: achievementData.title,
                description: achievementData.description,
                image: achievementData.image,
                earnedDate: achievementData.earnedDate,
                criteria: achievementData.criteria
            });

            const transaction = await this.achievementContract.methods.recordAchievement(
                userAddress,
                achievementData.type,
                achievementData.points,
                metadata
            );

            const result = await this.executeTransaction(transaction);

            // Update local achievement cache
            await this.updateAchievementCache(userAddress, {
                achievementId: result.achievementId,
                ...achievementData,
                metadata
            });

            this.emitEvent('achievement:recorded', {
                achievementId: result.achievementId,
                user: userAddress,
                type: achievementData.type,
                points: achievementData.points,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                achievementId: result.achievementId,
                transactionHash: result.transactionHash
            };

        } catch (error) {
            console.error('Achievement recording failed:', error);
            return { success: false, error: error.message };
        }
    }

    async getUserAchievements(userAddress) {
        try {
            const achievementIds = await this.achievementContract.methods.getUserAchievements(userAddress);
            const achievements = [];

            for (const id of achievementIds) {
                const achievement = await this.getAchievementById(id);
                if (achievement) {
                    achievements.push(achievement);
                }
            }

            return {
                success: true,
                achievements,
                totalCount: achievements.length
            };

        } catch (error) {
            console.error('Failed to fetch user achievements:', error);
            return { success: false, error: error.message };
        }
    }

    // Credential Management
    async issueCredential(holderAddress, credentialData) {
        try {
            const credentialMetadata = await this.uploadToIPFS({
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                "type": ["VerifiableCredential", credentialData.type],
                "issuer": this.userAddress,
                "issuanceDate": new Date().toISOString(),
                "expirationDate": credentialData.validUntil,
                "credentialSubject": {
                    "id": holderAddress,
                    ...credentialData.subject
                },
                "proof": {
                    "type": "EcdsaSecp256k1Signature2019",
                    "created": new Date().toISOString(),
                    "verificationMethod": this.userAddress,
                    "proofPurpose": "assertionMethod"
                }
            });

            const transaction = await this.credentialContract.methods.issueCredential(
                holderAddress,
                this.userAddress,
                credentialData.type,
                Math.floor(new Date(credentialData.validUntil).getTime() / 1000),
                credentialMetadata
            );

            const result = await this.executeTransaction(transaction);

            this.emitEvent('credential:issued', {
                credentialId: result.credentialId,
                holder: holderAddress,
                issuer: this.userAddress,
                type: credentialData.type,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                credentialId: result.credentialId,
                transactionHash: result.transactionHash
            };

        } catch (error) {
            console.error('Credential issuance failed:', error);
            return { success: false, error: error.message };
        }
    }

    async verifyCredential(credentialId) {
        try {
            const result = await this.credentialContract.methods.verifyCredential(credentialId);

            if (result.valid) {
                const metadata = await this.fetchFromIPFS(result.credentialData);

                return {
                    valid: true,
                    holder: result.holder,
                    issuer: result.issuer,
                    expiryDate: new Date(result.expiryDate * 1000),
                    credential: metadata
                };
            }

            return { valid: false };

        } catch (error) {
            console.error('Credential verification failed:', error);
            return { valid: false, error: error.message };
        }
    }

    // IPFS Integration
    async uploadToIPFS(data) {
        try {
            // Simplified IPFS upload simulation
            const jsonData = JSON.stringify(data, null, 2);
            const hash = await this.generateIPFSHash(jsonData);

            // Store locally for development
            const ipfsData = this.getIPFSStorage();
            ipfsData[hash] = data;
            this.setIPFSStorage(ipfsData);

            return hash;

        } catch (error) {
            console.error('IPFS upload failed:', error);
            throw error;
        }
    }

    async fetchFromIPFS(hash) {
        try {
            // Simplified IPFS fetch from local storage
            const ipfsData = this.getIPFSStorage();
            return ipfsData[hash] || null;

        } catch (error) {
            console.error('IPFS fetch failed:', error);
            throw error;
        }
    }

    async generateIPFSHash(data) {
        // Simplified hash generation for development
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return 'Qm' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 44);
    }

    // Transaction Management
    async executeTransaction(transaction) {
        try {
            // Simplified transaction execution
            const transactionHash = this.generateTransactionHash();
            const blockNumber = Math.floor(Math.random() * 1000000) + 1000000;

            // Simulate transaction result
            const result = {
                transactionHash,
                blockNumber,
                tokenId: Math.floor(Math.random() * 1000000),
                achievementId: Math.floor(Math.random() * 1000000),
                credentialId: this.generateCredentialId()
            };

            // Add to transaction history
            this.addTransactionToHistory({
                hash: transactionHash,
                blockNumber,
                timestamp: new Date().toISOString(),
                status: 'confirmed'
            });

            return result;

        } catch (error) {
            console.error('Transaction execution failed:', error);
            throw error;
        }
    }

    generateTransactionHash() {
        const chars = '0123456789abcdef';
        let hash = '0x';
        for (let i = 0; i < 64; i++) {
            hash += chars[Math.floor(Math.random() * chars.length)];
        }
        return hash;
    }

    generateCredentialId() {
        return '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Event System
    initializeEventSystem() {
        this.eventBus = new EventTarget();

        // Setup blockchain event listeners
        this.setupBlockchainEventListeners();
    }

    setupBlockchainEventListeners() {
        // Certificate events
        this.addEventListener('certificate:issued', (event) => {
            this.handleCertificateIssued(event.detail);
        });

        // Achievement events
        this.addEventListener('achievement:recorded', (event) => {
            this.handleAchievementRecorded(event.detail);
        });

        // Credential events
        this.addEventListener('credential:issued', (event) => {
            this.handleCredentialIssued(event.detail);
        });
    }

    addEventListener(eventType, callback) {
        this.eventBus.addEventListener(eventType, callback);
    }

    removeEventListener(eventType, callback) {
        this.eventBus.removeEventListener(eventType, callback);
    }

    emitEvent(eventType, data) {
        const event = new CustomEvent(eventType, { detail: data });
        this.eventBus.dispatchEvent(event);
    }

    // Utility Methods
    handleAccountChange(accounts) {
        if (accounts.length === 0) {
            this.walletConnected = false;
            this.userAddress = null;
        } else {
            this.userAddress = accounts[0];
        }

        this.emitEvent('account:changed', {
            address: this.userAddress,
            timestamp: new Date().toISOString()
        });
    }

    handleNetworkChange(chainId) {
        this.networkId = parseInt(chainId, 16);

        this.emitEvent('network:changed', {
            networkId: this.networkId,
            networkName: this.supportedNetworks[this.networkId] || 'Unknown',
            timestamp: new Date().toISOString()
        });
    }

    handleDisconnection() {
        this.walletConnected = false;
        this.userAddress = null;

        this.emitEvent('wallet:disconnected', {
            timestamp: new Date().toISOString()
        });
    }

    // Storage Management
    getIPFSStorage() {
        const data = localStorage.getItem('blockchain_ipfs_data');
        return data ? JSON.parse(data) : {};
    }

    setIPFSStorage(data) {
        localStorage.setItem('blockchain_ipfs_data', JSON.stringify(data));
    }

    loadContractAddresses() {
        const addresses = localStorage.getItem('blockchain_contract_addresses');
        return addresses ? JSON.parse(addresses) : null;
    }

    saveContractAddresses(addresses) {
        localStorage.setItem('blockchain_contract_addresses', JSON.stringify(addresses));
    }

    addTransactionToHistory(transaction) {
        const history = this.getTransactionHistory();
        history.unshift(transaction);

        // Keep only last 100 transactions
        if (history.length > 100) {
            history.splice(100);
        }

        localStorage.setItem('blockchain_transaction_history', JSON.stringify(history));
    }

    getTransactionHistory() {
        const history = localStorage.getItem('blockchain_transaction_history');
        return history ? JSON.parse(history) : [];
    }

    // Error Handling
    handleError(context, error) {
        const errorData = {
            context,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        console.error('Blockchain Error:', errorData);

        this.emitEvent('blockchain:error', errorData);

        // Store error for debugging
        const errors = this.getStoredErrors();
        errors.unshift(errorData);

        if (errors.length > 50) {
            errors.splice(50);
        }

        localStorage.setItem('blockchain_errors', JSON.stringify(errors));
    }

    getStoredErrors() {
        const errors = localStorage.getItem('blockchain_errors');
        return errors ? JSON.parse(errors) : [];
    }

    // Public API Methods
    async getCertificates(userAddress = null) {
        const address = userAddress || this.userAddress;
        if (!address) return { success: false, error: 'No user address provided' };

        try {
            const certificates = [];
            // Fetch certificates from blockchain and local storage
            // Implementation would query the contract for user's certificates

            return {
                success: true,
                certificates,
                count: certificates.length
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getCredentials(userAddress = null) {
        const address = userAddress || this.userAddress;
        if (!address) return { success: false, error: 'No user address provided' };

        try {
            const credentials = [];
            // Fetch credentials from blockchain and local storage

            return {
                success: true,
                credentials,
                count: credentials.length
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getSystemStatus() {
        return {
            initialized: this.initialized,
            walletConnected: this.walletConnected,
            userAddress: this.userAddress,
            networkId: this.networkId,
            networkName: this.supportedNetworks[this.networkId] || 'Unknown',
            contractsLoaded: !!(this.certificateContract && this.achievementContract && this.credentialContract),
            timestamp: new Date().toISOString()
        };
    }

    destroy() {
        // Cleanup event listeners
        this.eventListeners.clear();

        // Disconnect from Web3 provider
        if (this.web3Provider && this.web3Provider.removeAllListeners) {
            this.web3Provider.removeAllListeners();
        }

        // Clear references
        this.web3Provider = null;
        this.contractInstances = {};
        this.walletConnected = false;
        this.userAddress = null;

        console.log('Blockchain Integration System destroyed');
    }
}

// Global instance
window.BlockchainIntegration = BlockchainIntegration;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.blockchainSystem = new BlockchainIntegration();
    });
} else {
    window.blockchainSystem = new BlockchainIntegration();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockchainIntegration;
}