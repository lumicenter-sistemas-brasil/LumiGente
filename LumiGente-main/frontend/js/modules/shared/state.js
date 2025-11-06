// State Module - Gerenciamento de estado global
const State = {
    currentUser: null,
    users: [],
    selectedBadge: null,
    activeFilters: { type: null, category: null },
    currentFeedbackTab: 'received',
    selectedHumorScore: null,
    searchTimeout: null,

    setUser(user) {
        this.currentUser = user;
    },

    setUsers(users) {
        this.users = users;
    },

    getUser() {
        return this.currentUser;
    },

    getUsers() {
        return this.users;
    }
};
