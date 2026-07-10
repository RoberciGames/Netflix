// ==========================================
// INFRAESTRUTURA DE CHAVES E APIS (TMDB)
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
let itemSelecionado = null;
let estrelasAtivas = 0;
let debounceTimer; 
let currentUserUID = null;
let modoPlayerAtual = 'geral';

// ==========================================
// INSTANCIAÇÃO DO CORE FIREBASE (PROJECT: cinenet-ifpb)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAfPWvnGdvPKZ_lrVwOuag14WHLY9AgML8",
    authDomain: "cinenet-ifpb.firebaseapp.com",
    projectId: "cinenet-ifpb",
    storageBucket: "cinenet-ifpb.firebasestorage.app",
    messagingSenderId: "1098247355110",
    appId: "1:1098247355110:web:c9f867826f26b0ef171927"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
let biblioteca = { watchlist: {}, reviews: {} };
let isLoginMode = true;

// Escuta de Estado de Sessão
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUID = user.uid;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        
        // Puxa dados salvos na nuvem Firestore
        db.collection("usuarios").doc(user.uid).get().then((doc) => {
            if (doc.exists && doc.data().biblioteca) {
                biblioteca = doc.data().biblioteca;
            } else {
                biblioteca = JSON.parse(localStorage.getItem('cineNetflixLibV2')) || { watchlist: {}, reviews: {} };
            }
            carregarDashboard();
        }).catch(() => {
            biblioteca = JSON.parse(localStorage.getItem('cineNetflixLibV2')) || { watchlist: {}, reviews: {} };
            carregarDashboard(); 
        });
    } else {
        currentUserUID = null;
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

// Mecanismo de troca Login/Cadastro
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'NÚCLEO DE TRANSMISSÃO' : 'REQUISITAR NOVO ACESSO';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'AUTENTICAR SISTEMA' : 'REGISTRAR CREDENCIAIS';
    document.getElementById('auth-switch-text').innerText = isLoginMode ? 'Novo por aqui?' : 'Já possui registro?';
    document.getElementById('auth-link').innerText = isLoginMode ? 'Criar conta de acesso' : 'Fazer Login';
    document.getElementById('auth-error').style.display = 'none';
}

function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorBox = document.getElementById('auth-error');
    const btn = document.getElementById('auth-btn');

    btn.innerText = "SINCRO_PROCESSANDO..."; btn.disabled = true;
    errorBox.style.display = 'none';

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, pass).catch((error) => {
            errorBox.innerText = "Falha na validação. Verifique seus parâmetros.";
            errorBox.style.display = 'block'; btn.disabled = false; btn.innerText = "AUTENTICAR SISTEMA";
        });
    } else {
        auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
            db.collection("usuarios").doc(userCredential.user.uid).set({
                email: email, biblioteca: { watchlist: {}, reviews: {} }
            });
            btn.disabled = false;
        }).catch((error) => {
            errorBox.innerText = "Erro: " + error.message;
            errorBox.style.display = 'block'; btn.disabled = false; btn.innerText = "REGISTRAR CREDENCIAIS";
        });
    }
}

function fazerLogout() { auth.signOut(); }

function salvarDados() {
    localStorage.setItem('cineNetflixLibV2', JSON.stringify(biblioteca)); 
    if (currentUserUID) {
        db.collection("usuarios").doc(currentUserUID).update({ biblioteca: biblioteca })
        .then(() => renderizarMinhaLista()).catch(() => renderizarMinhaLista());
    } else {
        renderizarMinhaLista();
    }
}

// ==========================================
// MONTAGEM DO ENGINE DE CARROSSEIS (RESPONSIVO)
// ==========================================
function alternarScrollBody(travar) {
    if (travar) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
}

function injetarEstruturaRow(idContainer, tituloRow) {
    const wrapper = document.getElementById('rows-wrapper-layout');
    if (!wrapper || document.getElementById(`${idContainer}-section`)) return;
    const rowHtml = `
        <div class="movie-row" id="${idContainer}-section">
            <h2 class="section-title">${tituloRow}</h2>
            <div class="row-wrapper">
                <button class="scroll-btn left" onclick="scrollRow('${idContainer}', -1)">❮</button>
                <div class="row-posters" id="${idContainer}"></div>
                <button class="scroll-btn right" onclick="scrollRow('${idContainer}', 1)">❯</button>
            </div>
        </div>
    `;
    wrapper.insertAdjacentHTML('beforeend', rowHtml);
}

function scrollRow(idElemento, direcao) {
    const container = document.getElementById(idElemento);
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: scrollAmount * direcao, behavior: 'smooth' });
}

async function montarPostersMultiPage(urls, targetId, tipoFixo) {
    const container = document.getElementById(targetId);
    if(!container) return;
    container.innerHTML = ''; 

    for (let url of urls) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            if(!data.results) continue;

            data.results.forEach(item => {
                if(!item.poster_path) return;
                
                // RESOLUÇÃO DE CONFLITO DE ID (BUG DAS SÉRIES CORRIGIDO)
                item.custom_type = tipoFixo || item.media_type || (item.name ? 'tv' : 'movie');
                
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.onclick = () => abrirModal(item);
                
                const estaNaLista = biblioteca.watchlist[item.id] ? `<div class="watched-bar"></div>` : "";
                card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${item.title || item.name}" loading="lazy">${estaNaLista}`;
                container.appendChild(card);
            });
        } catch (err) { console.error(err); }
    }
}

async function carregarDashboard() {
    injetarEstruturaRow('row-movies', '🎬 Filmes em Destaque');
    injetarEstruturaRow('row-series', '📺 Séries e Produções');
    injetarEstruturaRow('row-animes', '🗡️ Universo Anime');
    injetarEstruturaRow('row-cartoons', '🎨 Desenhos Clássicos');
    injetarEstruturaRow('row-watchlist', '⭐ Minha Lista Pessoal');

    try {
        const resTrending = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`);
        const dataTrending = await resTrending.json();
        if(dataTrending.results && dataTrending.results.length > 0) configurarHero(dataTrending.results[0]);
    } catch(e) { console.error(e); }

    // Alimentação Massiva Multi-Páginas do Catálogo
    montarPostersMultiPage([
        `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`,
        `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=pt-BR&with_genres=28&page=1`
    ], 'row-movies', 'movie');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=18&page=1`
    ], 'row-series', 'tv');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=ja&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=ja&page=2`
    ], 'row-animes', 'tv');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=en&page=1`
    ], 'row-cartoons', 'tv');

    renderizarMinhaLista();
}

function configurarHero(item) {
    const banner = document.getElementById('hero-banner');
    if(!banner) return;
    banner.style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path}')`;
    document.getElementById('hero-title').innerText = item.title || item.name;
    document.getElementById('hero-synopsis').innerText = item.overview ? item.overview.substring(0, 180) + "..." : "Sinopse em atualização estrutural.";
    
    item.custom_type = item.media_type || (item.name ? 'tv' : 'movie');
    document.getElementById('hero-play-btn').onclick = () => { itemSelecionado = item; abrirPlayerAtual('geral'); };
}

function renderizarMinhaLista() {
    const container = document.getElementById('row-watchlist');
    const section = document.getElementById('row-watchlist-section');
    if(!container || !section) return;

    const itens = Object.values(biblioteca.watchlist).reverse();
    if(itens.length === 0) { section.style.display = 'none'; return; }

    section.style.display = 'block';
    container.innerHTML = '';
    
    itens.forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.onclick = () => abrirModal(item);
        card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}"><div class="watched-bar"></div>`;
        container.appendChild(card);
    });
}

// ==========================================
// CONTROLO DE FILTRAGEM E DISPOSITIVOS MÓVEIS
// ==========================================
function ativarBuscaMobile(e) {
    e.preventDefault();
    document.getElementById('mobile-search-overlay').style.display = 'block';
    document.getElementById('mobile-search-input').focus();
}

function fecharBuscaMobile() {
    document.getElementById('mobile-search-overlay').style.display = 'none';
    limparBusca();
}

// Tratamento de Busca Unificado (Debounce Adaptado)
const inputsBusca = ['.search-input-field', '#mobile-search-input'];
inputsBusca.forEach(seletor => {
    const el = document.querySelector(seletor);
    if(!el) return;
    el.addEventListener('input', (e) => {
        const termo = e.target.value;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => executarBuscaGlobal(termo), 400);
    });
});

async function executarBuscaGlobal(termo) {
    const home = document.getElementById('homepage-content');
    const searchSection = document.getElementById('search-results-section');
    const grid = document.getElementById('search-grid');

    if(!termo.trim()) { limparBusca(); return; }

    home.style.display = 'none'; searchSection.style.display = 'block';
    grid.innerHTML = '<p style="color: var(--primary-neon); padding: 20px;">Pesquisando servidores...</p>';

    try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(termo)}`);
        const data = await res.json();
        const filtrados = data.results.filter(i => i.media_type !== 'person' && i.poster_path);
        
        grid.innerHTML = '';
        if(filtrados.length === 0) { grid.innerHTML = '<p style="color: #666; padding: 20px;">Nenhum registo encontrado.</p>'; return; }

        filtrados.forEach(item => {
            item.custom_type = item.media_type || (item.name ? 'tv' : 'movie');
            const card = document.createElement('div');
            card.className = 'movie-card'; card.style.width = '100%';
            card.onclick = () => abrirModal(item);
            card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}">`;
            grid.appendChild(card);
        });
    } catch(err) { console.error(err); }
}

function limparBusca() {
    inputsBusca.forEach(s => { const el = document.querySelector(s); if(el) el.value = ""; });
    document.getElementById('homepage-content').style.display = 'block';
    document.getElementById('search-results-section').style.display = 'none';
}

// ==========================================
// INTERFACE DE DETALHES E CLASSIFICAÇÃO
// ==========================================
function abrirModal(item) {
    itemSelecionado = item;
    const id = item.id;
    const tipo = item.custom_type;

    document.getElementById('modal-hero-bg').style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}')`;
    document.getElementById('modal-title').innerText = item.title || item.name;
    document.getElementById('modal-desc').innerText = item.overview || "Ficheiro protegido. Sem descrição associada.";
    
    const baseMatch = item.vote_average ? Math.floor(item.vote_average * 10) : 88;
    document.getElementById('modal-match').innerText = `${baseMatch}% de Match`;
    document.getElementById('modal-year').innerText = (item.release_date || item.first_air_date || '2026').substring(0,4);

    const btnEspecifico = document.getElementById('btn-player-especifico');
    if (btnEspecifico) btnEspecifico.style.display = (tipo === 'movie') ? 'none' : 'inline-flex';

    const btnList = document.getElementById('modal-watchlist-btn');
    if(biblioteca.watchlist[id]) {
        btnList.innerText = '✓ Na minha Lista';
        btnList.style.borderColor = '#00ff88'; btnList.style.color = '#00ff88'; btnList.style.background = 'rgba(0, 255, 136, 0.1)';
    } else {
        btnList.innerText = '+ A Minha Lista';
        btnList.style.borderColor = 'rgba(255,255,255,0.2)'; btnList.style.color = 'white'; btnList.style.background = 'rgba(255,255,255,0.05)';
    }

    const dadosReview = biblioteca.reviews[id] || { rating: 0, text: "" };
    definirEstrelas(dadosReview.rating, false);
    document.getElementById('review-text').value = dadosReview.text;

    document.getElementById('detailsModal').style.display = 'flex';
    alternarScrollBody(true);
}

function fecharModal() { document.getElementById('detailsModal').style.display = 'none'; alternarScrollBody(false); }

function toggleWatchlist() {
    const id = itemSelecionado.id;
    if(biblioteca.watchlist[id]) delete biblioteca.watchlist[id];
    else biblioteca.watchlist[id] = itemSelecionado;
    
    salvarDados(); abrirModal(itemSelecionado); carregarDashboard();
}

function definirEstrelas(nota, cliqueUsuario = true) {
    if(cliqueUsuario) estrelasAtivas = nota;
    const sps = document.getElementById('star-rating').children;
    for(let i=0; i<5; i++) {
        if(i < (cliqueUsuario ? estrelasAtivas : nota)) sps[i].classList.add('active');
        else sps[i].classList.remove('active');
    }
}

function salvarCritica() {
    biblioteca.reviews[itemSelecionado.id] = { rating: estrelasAtivas, text: document.getElementById('review-text').value };
    salvarDados(); alert("Alterações registadas com sucesso.");
}

// ==========================================
// REPRODUTOR INTELIGENTE DE MÍDIA
// ==========================================
function abrirPlayerAtual(modo = 'geral') {
    if(!itemSelecionado) return;
    
    modoPlayerAtual = modo;
    const tipo = itemSelecionado.custom_type; 
    const modal = document.getElementById('playerModal');
    const epBox = document.getElementById('episodes-selectors-box');

    if (tipo === 'tv' && modo === 'especifico') {
        if(epBox) epBox.style.display = 'flex';
    } else {
        if(epBox) epBox.style.display = 'none';
    }

    fecharModal(); atualizarIframePlayer();
    modal.style.display = 'flex';
    alternarScrollBody(true);
}

function atualizarIframePlayer() {
    if (!itemSelecionado) return;
    const id = itemSelecionado.id;
    const tipo = itemSelecionado.custom_type;
    const player = document.getElementById('videoPlayer');

    if (tipo === 'movie') {
        player.src = `https://myembed.biz/filme/${id}`; 
    } else {
        if (modoPlayerAtual === 'geral') {
            player.src = `https://myembed.biz/serie/${id}`;
        } else {
            const season = document.getElementById('player-season-input').value || 1;
            const episode = document.getElementById('player-episode-input').value || 1;
            player.src = `https://myembed.biz/serie/${id}/${season}/${episode}`; 
        }
    }
}

function fecharPlayer() {
    document.getElementById('playerModal').style.display = 'none';
    document.getElementById('videoPlayer').src = "";
    alternarScrollBody(false);
}

// Sincronizador de abas ativas do desktop ao rolar
window.addEventListener('scroll', () => {
    if(window.innerWidth < 769) return;
    const sections = ['homepage-content', 'row-movies-section', 'row-series-section', 'row-animes-section', 'row-cartoons-section', 'row-watchlist-section'];
    let current = '';
    
    sections.forEach(s => {
        const el = document.getElementById(s);
        if(el) { const rect = el.getBoundingClientRect(); if(rect.top <= 120) current = s; }
    });

    document.querySelectorAll('.nav-menu a').forEach(a => {
        a.classList.remove('active');
        if(a.getAttribute('href') === `#${current}`) a.classList.add('active');
    });
});