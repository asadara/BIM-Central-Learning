/**
 * Questions Module - Handles BIM questions management
 * CRUD operations for Q&A system displayed on bim.html
 */
class QuestionsModule {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.allQuestions = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.filteredQuestions = [];
    }

    /**
     * Initialize the questions module
     */
    initialize() {
        console.log('❓ Initializing Questions Module');
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for question-related elements
     */
    setupEventListeners() {
        // Question search and filter inputs
        const searchInput = document.getElementById('questionSearchInput');
        if (searchInput) {
            searchInput.addEventListener('keyup', () => this.filterQuestions());
        }

        const statusFilter = document.getElementById('questionStatusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterQuestions());
        }

        const tagFilter = document.getElementById('questionTagFilter');
        if (tagFilter) {
            tagFilter.addEventListener('change', () => this.filterQuestions());
        }

        const sortFilter = document.getElementById('questionSortFilter');
        if (sortFilter) {
            sortFilter.addEventListener('change', () => this.filterQuestions());
        }

        // Create question modal
        const createQuestionBtn = document.querySelector('button[onclick*="showCreateQuestionModal"]');
        if (createQuestionBtn) {
            createQuestionBtn.addEventListener('click', () => this.showCreateQuestionModal());
        }

        // Refresh questions button
        const refreshBtn = document.querySelector('button[onclick*="loadQuestions"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadQuestions());
        }
    }

    /**
     * Load questions from API
     */
    async loadQuestions() {
        console.log('🔄 Loading questions...');

        const tableBody = document.getElementById('questionsTableBody');
        if (!tableBody) {
            console.error('❌ Questions table body not found');
            return;
        }

        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="d-flex flex-column align-items-center">
                        <div class="spinner-border text-primary mb-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="text-muted mb-0">Loading questions...</p>
                    </div>
                </td>
            </tr>`;

        try {
            const response = await fetch('/api/questions');
            console.log('📡 Questions API response:', response.status, response.statusText);

            if (response.ok) {
                const questions = await response.json();
                console.log('✅ Questions loaded successfully:', questions.length, 'questions');

                this.allQuestions = questions;
                this.displayQuestions(questions);

                // Update total questions count badge
                this.updateTotalQuestionsCount(questions.length);

                // Update results info
                this.updateQuestionsResultsInfo(questions.length, questions.length);
            } else {
                const errorText = await response.text();
                console.error('❌ Questions API failed:', response.status, errorText);
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-4">
                            <div class="alert alert-danger mb-0">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Failed to load questions: ${response.status} ${response.statusText}
                            </div>
                        </td>
                    </tr>`;
            }
        } catch (error) {
            console.error('❌ Error loading questions:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            Error loading questions: ${error.message}
                        </div>
                    </td>
                </tr>`;
        }
    }

    /**
     * Display questions in table
     */
    displayQuestions(questions) {
        const tableBody = document.getElementById('questionsTableBody');

        if (questions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <i class="fas fa-question-circle fa-3x text-muted mb-3"></i>
                            <p class="text-muted mb-2">No questions found</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        let html = '';
        questions.forEach((question, index) => {
            const questionId = question.id;
            const questionText = question.pertanyaan || question.question || 'N/A';
            const answerText = question.jawaban || question.answer || '';
            const status = question.status || 'pending';
            const tag = question.tag || question.category || 'general';
            const questioner = question.questioner || question.user || 'Anonymous';
            const createdDate = question.created_at || question.date || 'N/A';

            // Status badge
            let statusBadge = '';
            switch (status.toLowerCase()) {
                case 'answered':
                    statusBadge = '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Answered</span>';
                    break;
                case 'postponed':
                    statusBadge = '<span class="badge bg-warning"><i class="fas fa-clock me-1"></i>Postponed</span>';
                    break;
                case 'pending':
                default:
                    statusBadge = '<span class="badge bg-primary"><i class="fas fa-clock me-1"></i>Pending</span>';
                    break;
            }

            // Tag badge
            const tagBadge = `<span class="badge bg-info">${tag}</span>`;

            // Format date
            let formattedDate = 'N/A';
            if (createdDate && createdDate !== 'N/A') {
                try {
                    formattedDate = new Date(createdDate).toLocaleDateString('id-ID');
                } catch (e) {
                    formattedDate = createdDate;
                }
            }

            // Truncate long text
            const shortQuestion = questionText.length > 100 ? questionText.substring(0, 100) + '...' : questionText;
            const shortAnswer = answerText.length > 100 ? answerText.substring(0, 100) + '...' : answerText;

            html += `
                <tr>
                    <td class="text-center fw-bold">${index + 1}</td>
                    <td>
                        <div class="question-text" title="${questionText.replace(/"/g, '"')}">
                            ${shortQuestion}
                        </div>
                    </td>
                    <td>
                        <div class="answer-text ${answerText ? 'text-success' : 'text-muted'}" title="${answerText.replace(/"/g, '"') || 'Not answered yet'}">
                            ${shortAnswer || '<em>Not answered</em>'}
                        </div>
                    </td>
                    <td>${statusBadge}</td>
                    <td>${tagBadge}</td>
                    <td>${questioner}</td>
                    <td>${formattedDate}</td>
                    <td>
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-outline-primary" onclick="window.adminPanel.modules.get('questions').instance.answerQuestion('${questionId}')" title="Answer Question">
                                <i class="fas fa-reply"></i>
                            </button>
                            <button class="btn btn-outline-warning" onclick="window.adminPanel.modules.get('questions').instance.postponeQuestion('${questionId}', '${questionText.replace(/'/g, "\\'")}')" title="Postpone Question">
                                <i class="fas fa-clock"></i>
                            </button>
                            <button class="btn btn-outline-info" onclick="window.adminPanel.modules.get('questions').instance.viewQuestionDetails('${questionId}')" title="View Full Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="window.adminPanel.modules.get('questions').instance.deleteQuestion('${questionId}')" title="Delete Question">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });

        tableBody.innerHTML = html;
    }

    /**
     * Filter questions based on search and filter criteria
     */
    filterQuestions() {
        const searchTerm = document.getElementById('questionSearchInput').value.toLowerCase().trim();
        const statusFilter = document.getElementById('questionStatusFilter').value;
        const tagFilter = document.getElementById('questionTagFilter').value;
        const sortFilter = document.getElementById('questionSortFilter').value;

        let filteredQuestions = this.allQuestions.filter(question => {
            const questionText = (question.pertanyaan || question.question || '').toLowerCase();
            const answerText = (question.jawaban || question.answer || '').toLowerCase();
            const status = (question.status || 'pending').toLowerCase();
            const tag = (question.tag || question.category || 'general').toLowerCase();

            // Search filter
            const matchesSearch = !searchTerm ||
                questionText.includes(searchTerm) ||
                answerText.includes(searchTerm);

            // Status filter
            const matchesStatus = !statusFilter || status === statusFilter;

            // Tag filter
            const matchesTag = !tagFilter || tag === tagFilter;

            return matchesSearch && matchesStatus && matchesTag;
        });

        // Sort questions
        filteredQuestions.sort((a, b) => {
            const dateA = new Date(a.created_at || a.date || 0);
            const dateB = new Date(b.created_at || b.date || 0);

            switch (sortFilter) {
                case 'oldest':
                    return dateA - dateB;
                case 'newest':
                    return dateB - dateA;
                case 'unanswered':
                    const aAnswered = !!(a.jawaban || a.answer);
                    const bAnswered = !!(b.jawaban || b.answer);
                    if (aAnswered === bAnswered) return dateB - dateA;
                    return aAnswered ? 1 : -1;
                default:
                    return dateB - dateA;
            }
        });

        this.displayQuestions(filteredQuestions);
        this.updateQuestionsResultsInfo(filteredQuestions.length, this.allQuestions.length);
    }

    /**
     * Clear question filters
     */
    clearQuestionFilters() {
        document.getElementById('questionSearchInput').value = '';
        document.getElementById('questionStatusFilter').value = '';
        document.getElementById('questionTagFilter').value = '';
        document.getElementById('questionSortFilter').value = 'newest';

        this.displayQuestions(this.allQuestions);
        this.updateQuestionsResultsInfo(this.allQuestions.length, this.allQuestions.length);
    }

    /**
     * Update total questions count
     */
    updateTotalQuestionsCount(count) {
        const badge = document.getElementById('totalQuestionsCount');
        if (badge) {
            badge.innerHTML = `<i class="fas fa-question-circle me-1"></i>Total: ${count} questions`;
        }
    }

    /**
     * Update questions results info
     */
    updateQuestionsResultsInfo(filteredCount, totalCount) {
        // This function can be used to show filter results info if needed
        console.log(`Showing ${filteredCount} of ${totalCount} questions`);
    }

    /**
     * Show create question modal
     */
    showCreateQuestionModal() {
        // Create modal for admin to add a question
        const modalHtml = `
            <div class="modal fade" id="questionModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-plus me-2"></i>Add New Question
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="questionForm">
                            <div class="modal-body">
                                <div class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label">Question *</label>
                                        <textarea class="form-control" id="questionText" rows="4" required placeholder="Enter the BIM question..."></textarea>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Questioner Name</label>
                                        <input type="text" class="form-control" id="questionerName" placeholder="Name of person asking">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Tag/Category</label>
                                        <select class="form-select" id="questionTag">
                                            <option value="general">General BIM</option>
                                            <option value="autocad">AutoCAD</option>
                                            <option value="revit">Revit</option>
                                            <option value="career">Career</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="fas fa-save me-2"></i>Add Question
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>`;

        // Remove existing modal if any
        const existingModal = document.getElementById('questionModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Setup form submission
        document.getElementById('questionForm').addEventListener('submit', (e) => this.handleCreateQuestion(e));

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('questionModal'));
        modal.show();
    }

    /**
     * Handle create question form submission
     */
    async handleCreateQuestion(event) {
        event.preventDefault();

        const questionData = {
            pertanyaan: document.getElementById('questionText').value.trim(),
            questioner: document.getElementById('questionerName').value.trim(),
            tag: document.getElementById('questionTag').value,
            status: 'pending'
        };

        try {
            const submitBtn = event.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Adding...';
            submitBtn.disabled = true;

            const response = await fetch('/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(questionData)
            });

            if (response.ok) {
                const result = await response.json();
                alert('✅ Question added successfully!');

                // Close modal and refresh questions list
                bootstrap.Modal.getInstance(document.getElementById('questionModal')).hide();
                this.loadQuestions();
            } else {
                const error = await response.json();
                alert('❌ Failed to add question: ' + (error.error || 'Unknown error'));
            }

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

        } catch (error) {
            console.error('Error creating question:', error);
            alert('❌ Error adding question: ' + error.message);
            event.target.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-save me-2"></i>Add Question';
            event.target.querySelector('button[type="submit"]').disabled = false;
        }
    }

    /**
     * Answer question
     */
    answerQuestion(questionId) {
        // Find question data
        const question = this.allQuestions.find(q => q.id == questionId);
        if (!question) {
            alert('Question not found');
            return;
        }

        // Create answer modal
        const modalHtml = `
            <div class="modal fade" id="answerModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-reply me-2"></i>Answer Question
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="answerForm">
                            <div class="modal-body">
                                <div class="mb-4">
                                    <h6 class="text-primary">Question:</h6>
                                    <div class="border-start border-primary border-4 ps-3 py-2 bg-light">
                                        ${question.pertanyaan || question.question}
                                    </div>
                                </div>

                                <div class="mb-4">
                                    <h6 class="text-success">Your Answer:</h6>
                                    <textarea class="form-control" id="answerText" rows="8" required
                                        placeholder="Provide a comprehensive answer to this BIM question...">${question.jawaban || question.answer || ''}</textarea>
                                </div>

                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Update Status</label>
                                        <select class="form-select" id="answerStatus">
                                            <option value="answered" selected>Answered</option>
                                            <option value="pending">Keep Pending</option>
                                        </select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Answer Visibility</label>
                                        <select class="form-select" id="answerVisibility">
                                            <option value="public" selected>Public (show on bim.html)</option>
                                            <option value="private">Private (admin only)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-success">
                                    <i class="fas fa-save me-2"></i>Save Answer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>`;

        // Remove existing modal if any
        const existingModal = document.getElementById('answerModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Setup form submission
        document.getElementById('answerForm').addEventListener('submit', (e) => this.handleAnswerQuestion(e, questionId));

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('answerModal'));
        modal.show();
    }

    /**
     * Handle answer question form submission
     */
    async handleAnswerQuestion(event, questionId) {
        event.preventDefault();

        const answerData = {
            jawaban: document.getElementById('answerText').value.trim(),
            status: document.getElementById('answerStatus').value,
            visibility: document.getElementById('answerVisibility').value,
            answered_at: new Date().toISOString(),
            answered_by: 'Admin' // In a real app, this would be the logged-in admin
        };

        try {
            const submitBtn = event.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
            submitBtn.disabled = true;

            const response = await fetch(`/api/questions/${questionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(answerData)
            });

            if (response.ok) {
                alert('✅ Answer saved successfully! The answer will appear on bim.html if set to public.');

                // Close modal and refresh questions list
                bootstrap.Modal.getInstance(document.getElementById('answerModal')).hide();
                this.loadQuestions();
            } else {
                const error = await response.json();
                alert('❌ Failed to save answer: ' + (error.error || 'Unknown error'));
            }

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;

        } catch (error) {
            console.error('Error saving answer:', error);
            alert('❌ Error saving answer: ' + error.message);
            event.target.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-save me-2"></i>Save Answer';
            event.target.querySelector('button[type="submit"]').disabled = false;
        }
    }

    /**
     * Postpone question
     */
    postponeQuestion(questionId, questionText) {
        const reason = prompt(`Why do you want to postpone this question?\n\n"${questionText}"\n\nReason:`);

        if (reason && reason.trim()) {
            this.handlePostponeQuestion(questionId, reason.trim());
        }
    }

    /**
     * Handle postpone question
     */
    async handlePostponeQuestion(questionId, reason) {
        try {
            const postponeData = {
                status: 'postponed',
                postpone_reason: reason,
                postponed_at: new Date().toISOString(),
                postponed_by: 'Admin'
            };

            const response = await fetch(`/api/questions/${questionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postponeData)
            });

            if (response.ok) {
                alert('✅ Question postponed successfully. It will not appear on bim.html until reviewed.');

                // Refresh questions list
                this.loadQuestions();
            } else {
                const error = await response.json();
                alert('❌ Failed to postpone question: ' + (error.error || 'Unknown error'));
            }

        } catch (error) {
            console.error('Error postponing question:', error);
            alert('❌ Error postponing question: ' + error.message);
        }
    }

    /**
     * View question details
     */
    viewQuestionDetails(questionId) {
        // Find question data
        const question = this.allQuestions.find(q => q.id == questionId);
        if (!question) {
            alert('Question not found');
            return;
        }

        // Create details modal
        const modalHtml = `
            <div class="modal fade" id="detailsModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-eye me-2"></i>Question Details
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-4">
                                <div class="col-md-8">
                                    <h6 class="text-primary">Question:</h6>
                                    <div class="border-start border-primary border-4 ps-3 py-3 bg-light rounded">
                                        ${question.pertanyaan || question.question}
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card">
                                        <div class="card-body">
                                            <h6 class="card-title">Question Info</h6>
                                            <p class="mb-2"><strong>ID:</strong> ${question.id}</p>
                                            <p class="mb-2"><strong>Questioner:</strong> ${question.questioner || question.user || 'Anonymous'}</p>
                                            <p class="mb-2"><strong>Tag:</strong> <span class="badge bg-info">${question.tag || question.category || 'general'}</span></p>
                                            <p class="mb-2"><strong>Status:</strong> <span class="badge bg-${question.status === 'answered' ? 'success' : question.status === 'postponed' ? 'warning' : 'primary'}">${question.status || 'pending'}</span></p>
                                            <p class="mb-0"><strong>Date:</strong> ${question.created_at || question.date || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                ${question.jawaban || question.answer ? `
                                <div class="col-12">
                                    <h6 class="text-success">Answer:</h6>
                                    <div class="border-start border-success border-4 ps-3 py-3 bg-light rounded">
                                        ${question.jawaban || question.answer}
                                    </div>
                                </div>
                                ` : ''}

                                ${question.postpone_reason ? `
                                <div class="col-12">
                                    <h6 class="text-warning">Postpone Reason:</h6>
                                    <div class="border-start border-warning border-4 ps-3 py-3 bg-light rounded">
                                        ${question.postpone_reason}
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>`;

        // Remove existing modal if any
        const existingModal = document.getElementById('detailsModal');
        if (existingModal) existingModal.remove();

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
        modal.show();
    }

    /**
     * Delete question
     */
    deleteQuestion(questionId) {
        const confirmMsg = `Are you sure you want to permanently delete this question?\n\nThis action cannot be undone!`;

        if (confirm(confirmMsg)) {
            this.handleDeleteQuestion(questionId);
        }
    }

    /**
     * Handle delete question
     */
    async handleDeleteQuestion(questionId) {
        try {
            const response = await fetch(`/api/questions/${questionId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('✅ Question deleted successfully!');

                // Refresh questions list
                this.loadQuestions();
            } else {
                const error = await response.json();
                alert('❌ Failed to delete question: ' + (error.error || 'Unknown error'));
            }

        } catch (error) {
            console.error('Error deleting question:', error);
            alert('❌ Error deleting question: ' + error.message);
        }
    }

    /**
     * Export questions to CSV
     */
    exportQuestions() {
        if (this.allQuestions.length === 0) {
            alert('No questions to export');
            return;
        }

        // Create CSV content
        const headers = ['ID', 'Question', 'Answer', 'Status', 'Tag', 'Questioner', 'Created Date', 'Answered Date'];
        const csvContent = [
            headers.join(','),
            ...this.allQuestions.map(question => [
                question.id,
                `"${(question.pertanyaan || question.question || '').replace(/"/g, '""')}"`,
                `"${(question.jawaban || question.answer || '').replace(/"/g, '""')}"`,
                question.status || 'pending',
                question.tag || question.category || 'general',
                question.questioner || question.user || 'Anonymous',
                question.created_at || question.date || '',
                question.answered_at || ''
            ].join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bim-questions-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        alert('✅ Questions exported successfully!');
    }
}

// Initialize and register the questions module immediately when script loads
(function() {
    console.log('❓ Initializing Questions Module...');

    // Ensure adminPanel exists
    if (!window.adminPanel) {
        console.error('❌ window.adminPanel not found - questions module cannot initialize');
        return;
    }

    // Ensure modules Map exists
    if (!window.adminPanel.modules) {
        console.error('❌ window.adminPanel.modules not found - questions module cannot initialize');
        return;
    }

    try {
        // Create questions module instance
        const questionsModule = new QuestionsModule(window.adminPanel);

        // Set up the module entry
        window.adminPanel.modules.set('questions', {
            loaded: true,
            path: 'modules/questions.js',
            instance: questionsModule
        });

        // Initialize the module
        questionsModule.initialize();

        console.log('✅ Questions module initialized and registered successfully');
    } catch (error) {
        console.error('❌ Failed to initialize questions module:', error);
    }
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuestionsModule;
}
