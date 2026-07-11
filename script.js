// ==========================================
// INFRAESTRUTURA CORE
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
let itemSelecionado = null;
let estrelasAtivas = 0;
let debounceTimer; 
let currentUserUID = null;
let filtroBuscaAtual = 'all';
let ultimoTermoBusca = '';

// VARIÁVEIS DO PLAYER
let modoPlayerAtual = 'geral';
const corDestaque = 'e50914';

let perfilUsuario = {
    username: "Operador",
    avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
};
let avatarTemp = "";
let biblioteca = { watchlist: {}, reviews: {} };
let isLoginMode = true;

// FUNÇÃO AUXILIAR: Disparar rastreamento customizado para o Google Analytics
function trackVirtualPage(pageTitle, pagePath) {
    if (typeof gtag === 'function') {
        gtag('event', 'page_view', {
            page_title: pageTitle,
            page_path: pagePath
        });
    }
}

// ==========================================
// FIREBASE E AUTENTICAÇÃO
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAfPWvnGdvPKZ_lrVwOuag14WHLY9AgML8",
    authDomain: "cinenet-ifpb.firebaseapp.com",
    projectId: "cinenet-ifpb",
    storageBucket: "cinenet-ifpb.firebasestorage.app",
    messagingSenderId: "1098247355110",
    appId: "1:1098247355110:web:c9f867826f26b0ef171927"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Entrar' : 'Registar';
    document.getElementById('auth-submit-btn').innerText = isLoginMode ? 'Entrar' : 'Registar';
    document.getElementById('auth-switch-text').innerText = isLoginMode ? 'Novo por aqui?' : 'Já tem uma conta?';
    document.getElementById('auth-switch-btn').innerText = isLoginMode ? 'Registe-se agora.' : 'Entrar agora.';
    document.getElementById('auth-error').style.display = 'none';
}

function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    const errorBox = document.getElementById('auth-error');

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, pass).catch(err => {
            errorBox.innerText = "Erro ao entrar: Verifique as credenciais.";
            errorBox.style.display = 'block';
        });
    } else {
        auth.createUserWithEmailAndPassword(email, pass).catch(err => {
            errorBox.innerText = "Erro ao registar: " + err.message;
            errorBox.style.display = 'block';
        });
    }
}

auth.onAuthStateChanged(user => {
    if (user) {
        currentUserUID = user.uid;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        carregarDadosUsuario();
        irParaHome();
    } else {
        currentUserUID = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
});

function logout() { auth.signOut(); }

function carregarDadosUsuario() {
    db.ref('users/' + currentUserUID).once('value').then(snapshot => {
        const data = snapshot.val();
        if (data) {
            if (data.perfil) perfilUsuario = data.perfil;
            if (data.biblioteca) biblioteca = data.biblioteca;
            if (!biblioteca.watchlist) biblioteca.watchlist = {};
            if (!biblioteca.reviews) biblioteca.reviews = {};
        }
        atualizarUIUsuario();
    }).catch(error => console.error("Erro ao carregar dados do Firebase:", error));
}

function salvarDados() {
    if (currentUserUID) {
        db.ref('users/' + currentUserUID).set({ perfil: perfilUsuario, biblioteca: biblioteca });
    }
}

// ==========================================
// NAVEGAÇÃO ENTRE ABAS ISOLADAS (SPA)
// ==========================================
function setNavActive(idDesktop, idMobile) {
    document.querySelectorAll('.nav-menu a').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.mobile-bottom-nav a').forEach(el => el.classList.remove('active-nav'));
    if(idDesktop) document.getElementById(idDesktop).classList.add('active');
    if(idMobile) document.getElementById(idMobile).classList.add('active-nav');
}

function irParaHome() {
    setNavActive('nav-home', 'mob-nav-home');
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('search-results-section').style.display = 'none';
    document.getElementById('watchlist-section').style.display = 'none';
    carregarHome();
    trackVirtualPage("Início - CineNet", "/home");
}

function irParaBusca() {
    setNavActive('nav-search', 'mob-nav-search');
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('watchlist-section').style.display = 'none';
    document.getElementById('search-results-section').style.display = 'block';
    document.getElementById('main-search-input').focus();
    trackVirtualPage("Pesquisar - CineNet", "/search");
}

function irParaWatchlist() {
    setNavActive('nav-watchlist', 'mob-nav-watchlist');
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('search-results-section').style.display = 'none';
    document.getElementById('watchlist-section').style.display = 'block';
    renderizarWatchlist();
    trackVirtualPage("Minha Lista - CineNet", "/watchlist");
}

function alternarScrollBody(travar) {
    if (travar) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = `${scrollbarWidth}px`;
        document.body.classList.add('modal-open');
    } else {
        document.body.style.paddingRight = '0px';
        document.body.classList.remove('modal-open');
    }
}

// ==========================================
// RENDERS E CONEXÃO EXTERNA TMDB
// ==========================================
async function fetchTMDB(endpoint) {
    try {
        const url = `https://api.themoviedb.org/3${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_KEY}&language=pt-PT`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Falha na chamada TMDB");
        return await res.json();
    } catch (error) {
        console.error("Erro TMDB:", error);
        return { results: [] }; 
    }
}

async function carregarHome() {
    const [trend, movies, series] = await Promise.all([
        fetchTMDB('/trending/all/day'),
        fetchTMDB('/movie/popular'),
        fetchTMDB('/tv/popular')
    ]);

    if (trend.results.length > 0) {
        const hero = trend.results[0];
        document.getElementById('hero-banner').style.backgroundImage = `url(https://image.tmdb.org/t/p/original${hero.backdrop_path})`;
        document.getElementById('hero-title').innerText = hero.title || hero.name;
        document.getElementById('hero-desc').innerText = hero.overview || "Sem descrição disponível.";
        document.getElementById('hero-play-btn').onclick = () => abrirPlayer(hero.id, hero.media_type || 'movie');
        document.getElementById('hero-info-btn').onclick = () => abrirDetalhes(hero.id, hero.media_type || 'movie');
    }

    renderCards(trend.results, 'row-trending');
    renderCards(movies.results, 'row-movies', 'movie');
    renderCards(series.results, 'row-series', 'tv');
}

function renderCards(items, containerId, forceType = null) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';
    items.forEach(item => {
        if (!item.poster_path) return;
        const tipo = forceType || item.media_type || 'movie';
        const isWatched = biblioteca.watchlist[item.id] ? '<div class="watched-indicator">✔</div>' : '';
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w500${item.poster_path}" alt="Poster" loading="lazy">
            ${isWatched}
        `;
        card.onclick = () => abrirDetalhes(item.id, tipo);
        container.appendChild(card);
    });
}

// ==========================================
// ABA DE GERENCIAMENTO DE FAVORITOS (WATCHLIST)
// ==========================================
function renderizarWatchlist() {
    const container = document.getElementById('watchlist-grid');
    const emptyState = document.getElementById('watchlist-empty-state');
    container.innerHTML = '';

    const itens = Object.values(biblioteca.watchlist).sort((a, b) => b.adicionadoEm - a.adicionadoEm);
    const itensValidos = itens.filter(item => item && item.poster_path);

    if (itensValidos.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        itensValidos.forEach(item => {
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.innerHTML = `
                <img src="https://image.tmdb.org/t/p/w500${item.poster_path}" alt="Poster" loading="lazy">
                <div class="watched-indicator">✔</div>
            `;
            card.onclick = () => abrirDetalhes(item.id, item.tipo);
            container.appendChild(card);
        });
    }
}

// ==========================================
// ENGINE DE BUSCA AVANÇADA
// ==========================================
function iniciarBusca(termo) {
    clearTimeout(debounceTimer);
    document.getElementById('search-clear').style.display = termo.length > 0 ? 'block' : 'none';
    ultimoTermoBusca = termo;
    
    debounceTimer = setTimeout(() => {
        if (termo.length < 2) {
            document.getElementById('search-grid').innerHTML = '';
            return;
        }
        executarBuscaTMDB(termo);
    }, 600);
}

function limparBusca() {
    document.getElementById('main-search-input').value = '';
    document.getElementById('search-clear').style.display = 'none';
    document.getElementById('search-grid').innerHTML = '';
    ultimoTermoBusca = '';
}

function aplicarFiltro(tipo, elemento) {
    document.querySelectorAll('.filter-pill').forEach(el => el.classList.remove('active'));
    elemento.classList.add('active');
    filtroBuscaAtual = tipo;
    if (ultimoTermoBusca.length >= 2) executarBuscaTMDB(ultimoTermoBusca);
}

async function executarBuscaTMDB(termo) {
    const data = await fetchTMDB(`/search/multi?query=${encodeURIComponent(termo)}`);
    const container = document.getElementById('search-grid');
    const emptyState = document.getElementById('search-empty-state');
    container.innerHTML = '';

    let filtrados = data.results.filter(item => item.poster_path);
    if (filtroBuscaAtual !== 'all') {
        filtrados = filtrados.filter(item => item.media_type === filtroBuscaAtual);
    }

    if (filtrados.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        renderCards(filtrados, 'search-grid');
    }
}

// ==========================================
// MODAL DE DETALHES & FAVORITADOS
// ==========================================
async function abrirDetalhes(id, tipo) {
    const data = await fetchTMDB(`/${tipo}/${id}`);
    
    // Objeto consolidado para resolver bugs de posters ausentes nos favoritos
    itemSelecionado = { 
        id: id, 
        tipo: tipo, 
        poster_path: data.poster_path, 
        title: data.title || data.name 
    };
    
    document.getElementById('modal-banner').style.backgroundImage = `url(https://image.tmdb.org/t/p/original${data.backdrop_path || data.poster_path})`;
    document.getElementById('modal-title').innerText = itemSelecionado.title;
    document.getElementById('modal-overview').innerText = data.overview || "Sem descrição disponível.";
    
    const year = (data.release_date || data.first_air_date || "N/A").substring(0, 4);
    document.getElementById('modal-year').innerText = year;
    document.getElementById('modal-rating').innerText = (data.vote_average ? data.vote_average.toFixed(1) : "N/A") + " Relevância";

    document.getElementById('modal-play-btn').onclick = () => abrirPlayer(id, tipo);
    atualizarBotaoWatchlist();
    carregarReviewUI();

    document.getElementById('detailsModal').style.display = 'flex';
    alternarScrollBody(true);

    if (typeof gtag === 'function') {
        gtag('event', 'view_item_details', {
            'item_id': id,
            'item_title': itemSelecionado.title,
            'item_category': tipo
        });
    }
}

function fecharDetalhes() {
    document.getElementById('detailsModal').style.display = 'none';
    itemSelecionado = null;
    alternarScrollBody(false);
}

function alternarWatchlist() {
    if (!itemSelecionado) return;
    const id = itemSelecionado.id;
    let analyticsAction = "";

    if (biblioteca.watchlist[id]) {
        delete biblioteca.watchlist[id];
        analyticsAction = "remove_from_watchlist";
    } else {
        biblioteca.watchlist[id] = { 
            id: id,
            tipo: itemSelecionado.tipo,
            poster_path: itemSelecionado.poster_path,
            adicionadoEm: Date.now() 
        };
        analyticsAction = "add_to_watchlist";
    }
    
    atualizarBotaoWatchlist();
    salvarDados();

    if (typeof gtag === 'function') {
        gtag('event', analyticsAction, {
            'item_id': id,
            'item_name': itemSelecionado.title,
            'value': 1
        });
    }

    if (document.getElementById('watchlist-section').style.display === 'block') {
        renderizarWatchlist();
    }
}

function atualizarBotaoWatchlist() {
    const btn = document.getElementById('btn-watchlist');
    if (biblioteca.watchlist[itemSelecionado.id]) {
        btn.innerText = "✔ Na Minha Lista";
        btn.style.background = "rgba(255,255,255,0.2)";
    } else {
        btn.innerText = "+ Minha Lista";
        btn.style.background = "rgba(255,255,255,0.1)";
    }
}

function setRating(num) {
    estrelasAtivas = num;
    const spans = document.getElementById('star-container').children;
    for (let i = 0; i < spans.length; i++) {
        if (i < num) spans[i].classList.add('active');
        else spans[i].classList.remove('active');
    }
}

function carregarReviewUI() {
    estrelasAtivas = 0;
    document.getElementById('review-text').value = '';
    setRating(0);
    if (biblioteca.reviews[itemSelecionado.id]) {
        setRating(biblioteca.reviews[itemSelecionado.id].rating);
        document.getElementById('review-text').value = biblioteca.reviews[itemSelecionado.id].text || "";
    }
}

function salvarReview() {
    const nota = estrelasAtivas;
    const textoComentario = document.getElementById('review-text').value.trim();
    if (nota === 0) { alert("Selecione pelo menos 1 estrela."); return; }
    biblioteca.reviews[itemSelecionado.id] = { rating: nota, text: textoComentario };
    salvarDados(); 
    alert("Avaliação salva com sucesso!");
}

// ==========================================
// REPRODUTOR DE VÍDEO COMPLETO
// ==========================================
function abrirPlayer(id, tipo) {
    const epBox = document.getElementById('episodes-selectors-box');
    if (tipo === 'tv') { epBox.style.display = 'flex'; modoPlayerAtual = 'series'; } 
    else { epBox.style.display = 'none'; modoPlayerAtual = 'geral'; }

    document.getElementById('playerModal').style.display = 'flex';
    alternarScrollBody(true); 
    atualizarIframePlayer();

    if (typeof gtag === 'function' && itemSelecionado) {
        gtag('event', 'video_play', {
            'video_id': id,
            'video_title': itemSelecionado.title,
            'video_type': tipo
        });
    }
}

function fecharPlayer() { 
    document.getElementById('playerModal').style.display = 'none'; 
    document.getElementById('videoPlayer').src = ""; 
    alternarScrollBody(false); 
}

function atualizarIframePlayer() {
    if (!itemSelecionado) return;
    const id = itemSelecionado.id;
    const player = document.getElementById('videoPlayer');
    if (modoPlayerAtual === 'geral') {
        player.src = `https://mgeb.top/embed/${id}?player=vidstack#color:${corDestaque}`;
    } else {
        const season = document.getElementById('player-season-input').value || 1;
        const episode = document.getElementById('player-episode-input').value || 1;
        player.src = `https://mgeb.top/embed/tv/${id}/${season}/${episode}?player=vidstack#color:${corDestaque}`;
    }
}

// ==========================================
// PERFIL DO UTILIZADOR
// ==========================================
function abrirModalPerfil() {
    avatarTemp = perfilUsuario.avatar;
    document.getElementById('edit-username').value = perfilUsuario.username;
    document.getElementById('input-profile-avatar-url').value = ""; 
    document.querySelectorAll('.avatar-option').forEach(img => {
        if (img.src === avatarTemp) img.classList.add('active');
        else img.classList.remove('active');
    });
    document.getElementById('profileModal').style.display = 'flex';
    alternarScrollBody(true);
}

function fecharModalPerfil() {
    document.getElementById('profileModal').style.display = 'none';
    alternarScrollBody(false);
}

function selecionarAvatar(imgElement) {
    document.getElementById('input-profile-avatar-url').value = "";
    document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('active'));
    imgElement.classList.add('active');
    avatarTemp = imgElement.src;
}

function limparSelecaoAvatar() {
    document.querySelectorAll('.avatar-option').forEach(img => img.classList.remove('active'));
}

function salvarPerfil() {
    const novoNome = document.getElementById('edit-username').value.trim();
    const urlCustomizada = document.getElementById('input-profile-avatar-url').value.trim();
    
    if (novoNome) perfilUsuario.username = novoNome;
    perfilUsuario.avatar = urlCustomizada !== "" ? urlCustomizada : avatarTemp;

    salvarDados();
    atualizarUIUsuario();
    fecharModalPerfil();
}

function atualizarUIUsuario() {
    document.getElementById('user-avatar-pc').src = perfilUsuario.avatar;
    document.getElementById('user-avatar-mobile').src = perfilUsuario.avatar;
    document.getElementById('user-name-pc').innerText = perfilUsuario.username;
}