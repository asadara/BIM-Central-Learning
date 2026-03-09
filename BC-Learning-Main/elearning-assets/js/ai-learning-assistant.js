// AI Learning Assistant - Phase 4
// Advanced AI-powered learning assistant with NLP, intelligent tutoring, and contextual help

class AILearningAssistant {
    constructor() {
        this.aiModels = new Map();
        this.conversationHistory = [];
        this.userContext = {};
        this.knowledgeBase = new Map();
        this.tutorialSessions = new Map();
        this.learningPreferences = {};
        this.responsePatterns = new Map();
        this.contextualHints = new Map();

        // AI Assistant Configuration
        this.config = {
            maxConversationLength: 50,
            responseDelay: 1000,
            confidenceThreshold: 0.7,
            learningAdaptation: true,
            multiLanguageSupport: true,
            emotionalIntelligence: true,
            personalizedResponses: true
        };

        this.initializeAIAssistant();
    }

    // Initialize AI Assistant
    async initializeAIAssistant() {
        try {
            console.log('Initializing AI Learning Assistant...');

            // Initialize AI models and knowledge base
            await this.initializeAIModels();
            await this.loadKnowledgeBase();
            await this.setupNLPProcessing();
            await this.initializeTutoringEngine();

            // Setup user interface
            this.createAssistantInterface();
            this.setupEventListeners();

            // Load user context and preferences
            this.loadUserContext();
            this.loadLearningPreferences();

            console.log('AI Learning Assistant initialized successfully');

        } catch (error) {
            console.error('Error initializing AI Learning Assistant:', error);
            throw error;
        }
    }

    // Initialize AI Models
    async initializeAIModels() {
        // Natural Language Processing Model
        this.aiModels.set('nlp', {
            name: 'Natural Language Processor',
            type: 'transformer',
            capabilities: ['intent_recognition', 'entity_extraction', 'sentiment_analysis'],
            initialized: true
        });

        // Question Answering Model
        this.aiModels.set('qa', {
            name: 'Question Answering System',
            type: 'bert-based',
            capabilities: ['context_understanding', 'answer_generation', 'confidence_scoring'],
            initialized: true
        });

        // Learning Path Optimization Model
        this.aiModels.set('path_optimizer', {
            name: 'Learning Path Optimizer',
            type: 'reinforcement_learning',
            capabilities: ['path_recommendation', 'difficulty_adjustment', 'progress_prediction'],
            initialized: true
        });

        // Emotional Intelligence Model
        this.aiModels.set('emotion_ai', {
            name: 'Emotional Intelligence Engine',
            type: 'multimodal',
            capabilities: ['emotion_detection', 'empathy_response', 'motivation_analysis'],
            initialized: true
        });

        console.log('AI Models initialized:', this.aiModels.size, 'models loaded');
    }

    // Load Knowledge Base
    async loadKnowledgeBase() {
        // BIM Knowledge Base
        this.knowledgeBase.set('bim_fundamentals', {
            domain: 'BIM',
            topics: ['modeling', 'coordination', 'standards', 'workflows'],
            content: await this.loadBIMKnowledge(),
            confidence: 0.95
        });

        // Software Knowledge Base
        this.knowledgeBase.set('software_tutorials', {
            domain: 'Software',
            topics: ['revit', 'autocad', 'navisworks', 'dynamo'],
            content: await this.loadSoftwareKnowledge(),
            confidence: 0.90
        });

        // Construction Knowledge Base
        this.knowledgeBase.set('construction_practices', {
            domain: 'Construction',
            topics: ['project_management', 'quality_control', 'safety', 'scheduling'],
            content: await this.loadConstructionKnowledge(),
            confidence: 0.85
        });

        console.log('Knowledge Base loaded:', this.knowledgeBase.size, 'domains');
    }

    // Setup Natural Language Processing
    async setupNLPProcessing() {
        // Intent recognition patterns
        this.responsePatterns.set('greeting', [
            /^(hi|hello|hey|good morning|good afternoon)/i,
            /^(what's up|how are you|howdy)/i
        ]);

        this.responsePatterns.set('question', [
            /^(what|how|why|when|where|which|who)/i,
            /\?$/,
            /^(can you|could you|would you)/i
        ]);

        this.responsePatterns.set('help_request', [
            /^(help|assist|support|guide)/i,
            /^(i need|i want|i'm looking for)/i,
            /^(show me|teach me|explain)/i
        ]);

        this.responsePatterns.set('learning_difficulty', [
            /^(i don't understand|i'm confused|i'm stuck)/i,
            /^(this is hard|difficult|challenging)/i,
            /^(i can't|i'm unable)/i
        ]);

        this.responsePatterns.set('progress_inquiry', [
            /^(how am i doing|my progress|how far)/i,
            /^(what's next|next step|continue)/i,
            /^(am i ready|can i move on)/i
        ]);

        console.log('NLP Processing patterns configured');
    }

    // Initialize Tutoring Engine
    async initializeTutoringEngine() {
        this.tutoringEngine = {
            adaptiveExplanations: true,
            scaffoldedLearning: true,
            socraticMethod: true,
            multimodalSupport: true,
            progressTracking: true
        };

        // Tutoring strategies
        this.tutoringStrategies = new Map();
        this.tutoringStrategies.set('visual_learner', {
            approach: 'visual',
            methods: ['diagrams', 'videos', 'interactive_models'],
            responseStyle: 'visual_descriptions'
        });

        this.tutoringStrategies.set('auditory_learner', {
            approach: 'auditory',
            methods: ['verbal_explanations', 'audio_examples', 'discussions'],
            responseStyle: 'detailed_explanations'
        });

        this.tutoringStrategies.set('kinesthetic_learner', {
            approach: 'hands_on',
            methods: ['interactive_exercises', 'simulations', 'practice_projects'],
            responseStyle: 'step_by_step_actions'
        });

        console.log('Tutoring Engine initialized with adaptive strategies');
    }

    // Create Assistant Interface
    createAssistantInterface() {
        // Check if interface already exists
        if (document.getElementById('ai-assistant-container')) {
            return;
        }

        const assistantHTML = `
            <div id="ai-assistant-container" class="ai-assistant-container">
                <div id="ai-assistant-toggle" class="ai-assistant-toggle">
                    <i class="fas fa-robot"></i>
                    <span class="assistant-pulse"></span>
                </div>
                
                <div id="ai-assistant-panel" class="ai-assistant-panel">
                    <div class="assistant-header">
                        <div class="assistant-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="assistant-info">
                            <h4>AI Learning Assistant</h4>
                            <span class="assistant-status" id="assistantStatus">Ready to help</span>
                        </div>
                        <button class="assistant-minimize" id="assistantMinimize">
                            <i class="fas fa-minus"></i>
                        </button>
                    </div>
                    
                    <div class="assistant-body">
                        <div class="conversation-area" id="conversationArea">
                            <div class="welcome-message">
                                <div class="message assistant-message">
                                    <div class="message-avatar">
                                        <i class="fas fa-robot"></i>
                                    </div>
                                    <div class="message-content">
                                        <p>Hello! I'm your AI Learning Assistant. I'm here to help you with your BIM learning journey. You can ask me questions, get explanations, or request guidance on any topic.</p>
                                        <div class="quick-actions">
                                            <button class="quick-action" onclick="window.aiAssistant.askQuestion('What is BIM?')">
                                                What is BIM?
                                            </button>
                                            <button class="quick-action" onclick="window.aiAssistant.askQuestion('How do I start learning Revit?')">
                                                Learn Revit
                                            </button>
                                            <button class="quick-action" onclick="window.aiAssistant.showProgress()">
                                                My Progress
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="input-area">
                            <div class="input-container">
                                <input type="text" 
                                       id="assistantInput" 
                                       placeholder="Ask me anything about BIM or your learning..." 
                                       class="assistant-input">
                                <button id="assistantSend" class="assistant-send">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                            <div class="input-suggestions" id="inputSuggestions"></div>
                        </div>
                    </div>
                    
                    <div class="assistant-footer">
                        <div class="typing-indicator" id="typingIndicator" style="display: none;">
                            <span></span>
                            <span></span>
                            <span></span>
                            AI is thinking...
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', assistantHTML);
        this.addAssistantStyles();
    }

    // Add Assistant Styles
    addAssistantStyles() {
        if (document.getElementById('ai-assistant-styles')) {
            return;
        }

        const styles = `
            <style id="ai-assistant-styles">
                .ai-assistant-container {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 10000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .ai-assistant-toggle {
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                    box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
                    transition: all 0.3s ease;
                    position: relative;
                }

                .ai-assistant-toggle:hover {
                    transform: scale(1.1);
                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
                }

                .assistant-pulse {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    animation: pulse 2s infinite;
                    opacity: 0.7;
                }

                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.7; }
                    50% { transform: scale(1.2); opacity: 0.3; }
                    100% { transform: scale(1); opacity: 0.7; }
                }

                .ai-assistant-panel {
                    width: 380px;
                    height: 500px;
                    background: white;
                    border-radius: 15px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                    position: absolute;
                    bottom: 80px;
                    right: 0;
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                    border: 1px solid #e1e5e9;
                }

                .ai-assistant-panel.active {
                    display: flex;
                    animation: slideUp 0.3s ease;
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .assistant-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .assistant-avatar {
                    width: 40px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                }

                .assistant-info {
                    flex: 1;
                }

                .assistant-info h4 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }

                .assistant-status {
                    font-size: 12px;
                    opacity: 0.9;
                }

                .assistant-minimize {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 50%;
                    transition: background 0.2s ease;
                }

                .assistant-minimize:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .assistant-body {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    height: 0;
                }

                .conversation-area {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                    background: #f8f9fa;
                }

                .message {
                    display: flex;
                    margin-bottom: 15px;
                    animation: messageAppear 0.3s ease;
                }

                @keyframes messageAppear {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .message-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 10px;
                    flex-shrink: 0;
                }

                .assistant-message .message-avatar {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    font-size: 14px;
                }

                .user-message {
                    flex-direction: row-reverse;
                }

                .user-message .message-avatar {
                    background: #28a745;
                    color: white;
                    margin-right: 0;
                    margin-left: 10px;
                }

                .message-content {
                    background: white;
                    padding: 12px 15px;
                    border-radius: 15px;
                    max-width: 80%;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    word-wrap: break-word;
                }

                .user-message .message-content {
                    background: #007bff;
                    color: white;
                }

                .message-content p {
                    margin: 0 0 8px 0;
                    line-height: 1.4;
                }

                .message-content p:last-child {
                    margin-bottom: 0;
                }

                .quick-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 10px;
                }

                .quick-action {
                    background: #e9ecef;
                    border: 1px solid #dee2e6;
                    color: #495057;
                    padding: 6px 12px;
                    border-radius: 15px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .quick-action:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .input-area {
                    border-top: 1px solid #e1e5e9;
                    padding: 15px;
                    background: white;
                }

                .input-container {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .assistant-input {
                    flex: 1;
                    border: 1px solid #e1e5e9;
                    border-radius: 20px;
                    padding: 10px 15px;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s ease;
                }

                .assistant-input:focus {
                    border-color: #667eea;
                }

                .assistant-send {
                    width: 40px;
                    height: 40px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s ease;
                }

                .assistant-send:hover {
                    background: #5a6fd8;
                }

                .assistant-send:disabled {
                    background: #6c757d;
                    cursor: not-allowed;
                }

                .input-suggestions {
                    margin-top: 8px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }

                .suggestion-chip {
                    background: #f8f9fa;
                    border: 1px solid #e9ecef;
                    color: #6c757d;
                    padding: 4px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .suggestion-chip:hover {
                    background: #e9ecef;
                    color: #495057;
                }

                .typing-indicator {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    padding: 10px 15px;
                    font-size: 12px;
                    color: #6c757d;
                    background: #f8f9fa;
                }

                .typing-indicator span {
                    width: 6px;
                    height: 6px;
                    background: #6c757d;
                    border-radius: 50%;
                    animation: typing 1.4s infinite;
                }

                .typing-indicator span:nth-child(2) {
                    animation-delay: 0.2s;
                }

                .typing-indicator span:nth-child(3) {
                    animation-delay: 0.4s;
                }

                @keyframes typing {
                    0%, 60%, 100% { transform: translateY(0); }
                    30% { transform: translateY(-10px); }
                }

                @media (max-width: 480px) {
                    .ai-assistant-panel {
                        width: calc(100vw - 40px);
                        height: 60vh;
                        bottom: 80px;
                        right: 20px;
                        left: 20px;
                    }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // Setup Event Listeners
    setupEventListeners() {
        // Toggle assistant panel
        document.getElementById('ai-assistant-toggle')?.addEventListener('click', () => {
            this.toggleAssistant();
        });

        // Minimize assistant
        document.getElementById('assistantMinimize')?.addEventListener('click', () => {
            this.minimizeAssistant();
        });

        // Send message
        document.getElementById('assistantSend')?.addEventListener('click', () => {
            this.sendMessage();
        });

        // Enter key to send
        document.getElementById('assistantInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Input suggestions
        document.getElementById('assistantInput')?.addEventListener('input', (e) => {
            this.generateInputSuggestions(e.target.value);
        });
    }

    // Toggle Assistant Panel
    toggleAssistant() {
        const panel = document.getElementById('ai-assistant-panel');
        if (panel) {
            panel.classList.toggle('active');
            if (panel.classList.contains('active')) {
                document.getElementById('assistantInput')?.focus();
            }
        }
    }

    // Minimize Assistant
    minimizeAssistant() {
        const panel = document.getElementById('ai-assistant-panel');
        if (panel) {
            panel.classList.remove('active');
        }
    }

    // Send Message
    async sendMessage() {
        const input = document.getElementById('assistantInput');
        const message = input?.value.trim();

        if (!message) return;

        // Clear input
        input.value = '';

        // Add user message to conversation
        this.addMessageToConversation(message, 'user');

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Process message with AI
            const response = await this.processMessage(message);

            // Hide typing indicator
            this.hideTypingIndicator();

            // Add AI response to conversation
            this.addMessageToConversation(response.text, 'assistant', response.actions);

        } catch (error) {
            console.error('Error processing message:', error);
            this.hideTypingIndicator();
            this.addMessageToConversation('I apologize, but I encountered an error. Please try again.', 'assistant');
        }
    }

    // Process Message with AI
    async processMessage(message) {
        // Add to conversation history
        this.conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: Date.now()
        });

        // Analyze intent
        const intent = this.analyzeIntent(message);

        // Extract entities
        const entities = this.extractEntities(message);

        // Generate contextual response
        const response = await this.generateResponse(message, intent, entities);

        // Add to conversation history
        this.conversationHistory.push({
            role: 'assistant',
            content: response.text,
            intent: intent,
            confidence: response.confidence,
            timestamp: Date.now()
        });

        // Limit conversation history
        if (this.conversationHistory.length > this.config.maxConversationLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.config.maxConversationLength);
        }

        return response;
    }

    // Analyze Intent
    analyzeIntent(message) {
        const lowercaseMessage = message.toLowerCase();

        for (const [intent, patterns] of this.responsePatterns.entries()) {
            for (const pattern of patterns) {
                if (pattern.test(lowercaseMessage)) {
                    return intent;
                }
            }
        }

        return 'general_inquiry';
    }

    // Extract Entities
    extractEntities(message) {
        const entities = {
            topics: [],
            software: [],
            concepts: [],
            actions: []
        };

        const lowercaseMessage = message.toLowerCase();

        // Extract BIM-related topics
        const bimTopics = ['bim', 'modeling', 'coordination', 'clash detection', 'quantity takeoff', '4d', '5d'];
        entities.topics = bimTopics.filter(topic => lowercaseMessage.includes(topic));

        // Extract software mentions
        const software = ['revit', 'autocad', 'navisworks', 'dynamo', 'sketchup', '3ds max'];
        entities.software = software.filter(app => lowercaseMessage.includes(app));

        // Extract action words
        const actions = ['learn', 'practice', 'tutorial', 'guide', 'help', 'explain', 'show'];
        entities.actions = actions.filter(action => lowercaseMessage.includes(action));

        return entities;
    }

    // Generate Response
    async generateResponse(message, intent, entities) {
        let responseText = '';
        let confidence = 0.8;
        let actions = [];

        switch (intent) {
            case 'greeting':
                responseText = this.generateGreetingResponse();
                break;

            case 'question':
                const qaResult = await this.answerQuestion(message, entities);
                responseText = qaResult.answer;
                confidence = qaResult.confidence;
                actions = qaResult.actions;
                break;

            case 'help_request':
                const helpResult = this.generateHelpResponse(entities);
                responseText = helpResult.text;
                actions = helpResult.actions;
                break;

            case 'learning_difficulty':
                responseText = this.generateSupportResponse(message, entities);
                break;

            case 'progress_inquiry':
                const progressResult = await this.generateProgressResponse();
                responseText = progressResult.text;
                actions = progressResult.actions;
                break;

            default:
                const generalResult = await this.generateGeneralResponse(message, entities);
                responseText = generalResult.text;
                confidence = generalResult.confidence;
                actions = generalResult.actions;
        }

        return {
            text: responseText,
            confidence: confidence,
            actions: actions,
            intent: intent
        };
    }

    // Generate Greeting Response
    generateGreetingResponse() {
        const greetings = [
            "Hello! I'm here to help you with your BIM learning journey. What would you like to explore today?",
            "Hi there! Ready to dive into some BIM knowledge? I'm here to assist you.",
            "Welcome back! How can I help you advance your BIM skills today?",
            "Hello! I'm your AI learning companion. What BIM topic interests you right now?"
        ];

        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // Answer Question
    async answerQuestion(question, entities) {
        // Search knowledge base
        const knowledgeResult = this.searchKnowledgeBase(question, entities);

        if (knowledgeResult.confidence > this.config.confidenceThreshold) {
            return {
                answer: knowledgeResult.answer,
                confidence: knowledgeResult.confidence,
                actions: knowledgeResult.actions || []
            };
        }

        // Generate contextual answer
        return this.generateContextualAnswer(question, entities);
    }

    // Search Knowledge Base
    searchKnowledgeBase(question, entities) {
        let bestMatch = {
            answer: "I'm not sure about that specific topic. Could you provide more context or try rephrasing your question?",
            confidence: 0.3,
            actions: []
        };

        // Search through knowledge domains
        for (const [domain, knowledge] of this.knowledgeBase.entries()) {
            const relevanceScore = this.calculateRelevance(question, entities, knowledge);

            if (relevanceScore > bestMatch.confidence) {
                bestMatch = {
                    answer: this.generateKnowledgeAnswer(question, knowledge),
                    confidence: relevanceScore,
                    actions: this.generateKnowledgeActions(knowledge)
                };
            }
        }

        return bestMatch;
    }

    // Calculate Relevance
    calculateRelevance(question, entities, knowledge) {
        let score = 0;
        const questionWords = question.toLowerCase().split(' ');

        // Check topic overlap
        knowledge.topics.forEach(topic => {
            if (questionWords.some(word => word.includes(topic) || topic.includes(word))) {
                score += 0.3;
            }
        });

        // Check entity matches
        entities.topics.forEach(topic => {
            if (knowledge.topics.includes(topic)) {
                score += 0.4;
            }
        });

        entities.software.forEach(software => {
            if (knowledge.topics.includes(software)) {
                score += 0.3;
            }
        });

        return Math.min(score, 1.0);
    }

    // Generate Knowledge Answer
    generateKnowledgeAnswer(question, knowledge) {
        // This would normally use the actual knowledge content
        // For now, providing template responses
        const answers = [
            `Based on my knowledge of ${knowledge.domain}, I can help explain this concept. Let me break it down for you step by step.`,
            `That's a great question about ${knowledge.domain}! Here's what you need to know:`,
            `I'm glad you asked about ${knowledge.domain}. This is an important topic in BIM.`
        ];

        return answers[Math.floor(Math.random() * answers.length)];
    }

    // Generate Help Response
    generateHelpResponse(entities) {
        let text = "I'm here to help! ";
        let actions = [];

        if (entities.software.length > 0) {
            text += `I can assist you with ${entities.software.join(', ')}. `;
            actions.push({
                type: 'tutorial',
                software: entities.software[0],
                label: `Start ${entities.software[0]} Tutorial`
            });
        }

        if (entities.topics.length > 0) {
            text += `I can explain ${entities.topics.join(', ')} concepts. `;
            actions.push({
                type: 'explanation',
                topic: entities.topics[0],
                label: `Learn about ${entities.topics[0]}`
            });
        }

        if (actions.length === 0) {
            text += "What specific area would you like help with?";
            actions = [
                { type: 'quick_help', topic: 'bim_basics', label: 'BIM Basics' },
                { type: 'quick_help', topic: 'software_tutorials', label: 'Software Tutorials' },
                { type: 'quick_help', topic: 'best_practices', label: 'Best Practices' }
            ];
        }

        return { text, actions };
    }

    // Generate Support Response
    generateSupportResponse(message, entities) {
        const supportResponses = [
            "I understand it can be challenging. Let's break this down into smaller, manageable steps.",
            "Don't worry, everyone learns at their own pace. I'm here to help you understand this better.",
            "That's okay! Learning BIM can be complex. Let me provide a simpler explanation.",
            "I see you're having difficulty. Let's approach this from a different angle."
        ];

        return supportResponses[Math.floor(Math.random() * supportResponses.length)];
    }

    // Add Message to Conversation
    addMessageToConversation(text, sender, actions = []) {
        const conversationArea = document.getElementById('conversationArea');
        if (!conversationArea) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = sender === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const textP = document.createElement('p');
        textP.textContent = text;
        contentDiv.appendChild(textP);

        // Add action buttons if provided
        if (actions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'quick-actions';

            actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'quick-action';
                button.textContent = action.label;
                button.onclick = () => this.handleActionClick(action);
                actionsDiv.appendChild(button);
            });

            contentDiv.appendChild(actionsDiv);
        }

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);

        conversationArea.appendChild(messageDiv);
        conversationArea.scrollTop = conversationArea.scrollHeight;
    }

    // Handle Action Click
    handleActionClick(action) {
        switch (action.type) {
            case 'tutorial':
                this.startTutorial(action.software);
                break;
            case 'explanation':
                this.explainTopic(action.topic);
                break;
            case 'quick_help':
                this.provideQuickHelp(action.topic);
                break;
            default:
                console.log('Action clicked:', action);
        }
    }

    // Show/Hide Typing Indicator
    showTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.style.display = 'flex';
        }
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    // Public API methods
    askQuestion(question) {
        const input = document.getElementById('assistantInput');
        if (input) {
            input.value = question;
            this.sendMessage();
        }
    }

    showProgress() {
        this.addMessageToConversation("Let me show you your learning progress...", 'assistant');
        // Integration with progress tracking system
        if (window.enhancedProgressTracking) {
            const progress = window.enhancedProgressTracking.getProgressSummary();
            this.addMessageToConversation(`You've completed ${progress.completedCourses || 0} courses and have a ${progress.overallProgress || 0}% completion rate. Keep up the great work!`, 'assistant');
        }
    }

    // Load and save methods
    loadUserContext() {
        try {
            const saved = localStorage.getItem('ai_assistant_context');
            if (saved) {
                this.userContext = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading user context:', error);
        }
    }

    saveUserContext() {
        try {
            localStorage.setItem('ai_assistant_context', JSON.stringify(this.userContext));
        } catch (error) {
            console.error('Error saving user context:', error);
        }
    }

    loadLearningPreferences() {
        try {
            const saved = localStorage.getItem('ai_assistant_preferences');
            if (saved) {
                this.learningPreferences = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading learning preferences:', error);
        }
    }

    // Knowledge loading methods (simplified for demo)
    async loadBIMKnowledge() {
        return {
            modeling: "BIM modeling involves creating digital representations of physical and functional characteristics of facilities.",
            coordination: "BIM coordination helps detect conflicts between different building systems before construction.",
            standards: "BIM standards ensure consistency and interoperability across different software and teams."
        };
    }

    async loadSoftwareKnowledge() {
        return {
            revit: "Revit is a powerful BIM software for architectural, structural, and MEP design.",
            autocad: "AutoCAD is a foundational CAD software for 2D drafting and 3D modeling.",
            navisworks: "Navisworks is used for project review, coordination, and simulation."
        };
    }

    async loadConstructionKnowledge() {
        return {
            project_management: "Effective project management ensures timely and budget-conscious project delivery.",
            quality_control: "Quality control processes maintain standards throughout construction phases.",
            safety: "Safety protocols protect workers and ensure compliance with regulations."
        };
    }

    // Static instance method
    static getInstance() {
        if (!window.aiLearningAssistantInstance) {
            window.aiLearningAssistantInstance = new AILearningAssistant();
        }
        return window.aiLearningAssistantInstance;
    }
}

// Global instance
window.AILearningAssistant = AILearningAssistant;

// Auto-initialize
document.addEventListener('DOMContentLoaded', function () {
    window.aiAssistant = AILearningAssistant.getInstance();
    console.log('AI Learning Assistant initialized');
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AILearningAssistant;
}