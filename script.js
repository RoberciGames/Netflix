// ==========================================
// CONFIGURAÇÕES GERAIS E API
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
let itemSelecionado = null;
let estrelasAtivas = 0;
let timerBusca; 
let currentUserUID = null;
let modoPlayerAtual = 'geral'; // Define se vai abrir a listagem ou episódio fixo

// ==========================================
// CONFIGURAÇÃO DO FIREBASE OFICIAL
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAfPWvnGdvPKZ_lrVwOuag14WHLY9AgML8",
    authDomain: "cinenet-ifpb.firebaseapp.com",
    projectId: "cinenet-ifpb",
    storageBucket: "cinenet-ifpb.firebasestorage.app",
    messagingSenderId: "1098247355110",
    appId: "1:1098247355110:web:c9f867826f26b0ef171927"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
let biblioteca = { watchlist: {}, reviews: {} };

// ==========================================
// SISTEMA DE LOGIN NA NUVEM
// ==========================================
let isLoginMode = true;

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUID = user.uid;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        
        db.collection("usuarios").doc(user.uid).get().then((doc) => {
            if (doc.exists) biblioteca = doc.data().biblioteca || { watchlist: {}, reviews: {} };
            else biblioteca = { watchlist: {}, reviews: {} };
            carregarDashboard();
        });
    } else {
        currentUserUID = null;
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Aceder ao Portal' : 'Criar Nova Conta';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'Entrar' : 'Registar Conta';
    document.getElementById('auth-link').innerText = isLoginMode ? 'Registe-se agora.' : 'Entrar agora.';
    document.getElementById('auth-error').style.display = 'none';
}

function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorBox = document.getElementById('auth-error');
    const btn = document.getElementById('auth-btn');

    btn.innerText = "Aguarde...";
    btn.disabled = true;

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, pass).catch((error) => {
            errorBox.innerText = "Erro: Email ou senha inválidos.";
            errorBox.style.display = 'block';
            btn.disabled = false; btn.innerText = "Entrar";
        });
    } else {
        auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
            db.collection("usuarios").doc(userCredential.user.uid).set({
                email: email,
                biblioteca: { watchlist: {}, reviews: {} }
            });
            btn.disabled = false;
        }).catch((error) => {
            errorBox.innerText = "Erro: " + error.message;
            errorBox.style.display = 'block';
            btn.disabled = false; btn.innerText = "Registar Conta";
        });
    }
}

function fazerLogout() { auth.signOut(); }

function salvarDados() {
    if (currentUserUID) {
        db.collection("usuarios").doc(currentUserUID).update({ biblioteca: biblioteca })
        .then(() => renderizarMinhaLista()).catch((error) => console.error("Erro ao salvar: ", error));
    }
}

// ==========================================
// RENDERIZAÇÃO DA INTERFACE E CARROSSEIS
// ==========================================
function alternarScrollBody(travar) {
    if (travar) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
}

window.addEventListener('click', function(event) {
    const detailsModal = document.getElementById('detailsModal');
    if (event.target === detailsModal) fecharModal();
});

window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 30) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
});

function injetarEstruturaRow(idContainer, tituloRow) {
    const wrapper = document.getElementById('rows-wrapper-layout');
    const rowHtml = `
        <div class="movie-row" id="${idContainer}-section">
            <div class="row-title">${tituloRow}</div>
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
    const scrollAmount = container.clientWidth * 0.75;
    container.scrollBy({ left: scrollAmount * direcao, behavior: 'smooth' });
}

async function montarPostersMultiPage(urls, targetId, tipoFixo) {
    const container = document.getElementById(targetId);
    if(!container) return;

    for (let url of urls) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            data.results.forEach(item => {
                if(!item.poster_path) return;
                item.custom_type = item.media_type || tipoFixo;
                
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.onclick = (e) => { e.preventDefault(); e.stopPropagation(); abrirModal(item); };
                
                const estaNaLista = biblioteca.watchlist[item.id] ? `<div class="watched-bar"></div>` : "";
                const titulo = item.title || item.name;
                card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${titulo}" loading="lazy">${estaNaLista}`;
                container.appendChild(card);
            });
        } catch (err) { console.error(err); }
    }
}

async function carregarDashboard() {
    const wrapper = document.getElementById('rows-wrapper-layout');
    wrapper.innerHTML = '';

    injetarEstruturaRow('row-movies', '🎬 Filmes Blockbusters');
    injetarEstruturaRow('row-series', '📺 Séries e Maratonas');
    injetarEstruturaRow('row-animes', '🗡️ Universo Anime');
    injetarEstruturaRow('row-cartoons', '🎨 Desenhos e Clássicos');
    injetarEstruturaRow('row-watchlist', '⭐ A Minha Lista de Favoritos');

    try {
        const resTrending = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`);
        const dataTrending = await resTrending.json();
        if(dataTrending.results.length > 0) configurarHero(dataTrending.results[0]);
    } catch(e) {}

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`,
        `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=pt-BR&with_genres=28&page=1`
    ], 'row-movies', 'movie');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=18&page=1`
    ], 'row-series', 'tv');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=2`
    ], 'row-animes', 'tv');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=en&sort_by=popularity.desc&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=en&sort_by=popularity.desc&page=2`
    ], 'row-cartoons', 'tv');

    renderizarMinhaLista();
}

function configurarHero(item) {
    const banner = document.getElementById('hero-banner');
    const title = document.getElementById('hero-title');
    const synopsis = document.getElementById('hero-synopsis');
    
    banner.style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path}')`;
    title.innerText = item.title || item.name;
    synopsis.innerText = item.overview ? item.overview.substring(0, 200) + "..." : "Sem descrição disponível.";

    item.custom_type = item.media_type || (item.title ? 'movie' : 'tv');
    
    document.getElementById('hero-play-btn').onclick = () => { itemSelecionado = item; abrirPlayerAtual('geral'); };
}

function renderizarMinhaLista() {
    const container = document.getElementById('row-watchlist');
    const section = document.getElementById('row-watchlist-section');
    if(!container || !section) return;

    const itens = Object.values(biblioteca.watchlist).reverse();

    if(itens.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = '';
    
    itens.forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.onclick = (e) => { e.preventDefault(); e.stopPropagation(); abrirModal(item); };
        const titulo = item.title || item.name;
        card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${titulo}"><div class="watched-bar"></div>`;
        container.appendChild(card);
    });
}

// ==========================================
// PESQUISA RÁPIDA (DEBOUNCE)
// ==========================================
document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(timerBusca);
    timerBusca = setTimeout(async () => {
        const termo = e.target.value;
        const home = document.getElementById('homepage-content');
        const searchSection = document.getElementById('search-results-section');
        const grid = document.getElementById('search-grid');

        if(!termo.trim()) { limparBusca(); return; }

        home.style.display = 'none';
        searchSection.style.display = 'block';
        grid.innerHTML = '<p style="color: white; padding: 20px;">A pesquisar...</p>';

        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(termo)}`);
            const data = await res.json();
            const filtrados = data.results.filter(i => i.media_type !== 'person' && i.poster_path);
            
            grid.innerHTML = '';
            if(filtrados.length === 0) {
                grid.innerHTML = '<p style="color: var(--text-grey); padding: 20px;">Nenhum conteúdo encontrado.</p>';
                return;
            }

            filtrados.forEach(item => {
                item.custom_type = item.media_type || (item.title ? 'movie' : 'tv');
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.style.width = '100%';
                card.onclick = (e) => { e.preventDefault(); e.stopPropagation(); abrirModal(item); };
                card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}">`;
                grid.appendChild(card);
            });
        } catch(err) { console.error(err); }
    }, 500); 
});

function limparBusca() {
    document.getElementById('search-input').value = "";
    document.getElementById('homepage-content').style.display = 'block';
    document.getElementById('search-results-section').style.display = 'none';
}

// ==========================================
// MODAL DE DETALHES E AVALIAÇÃO
// ==========================================
function abrirModal(item) {
    itemSelecionado = item;
    const id = item.id;
    const tipo = item.custom_type || (item.title ? 'movie' : 'tv');

    document.getElementById('modal-hero-bg').style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}')`;
    document.getElementById('modal-title').innerText = item.title || item.name;
    document.getElementById('modal-desc').innerText = item.overview || "Esta obra ainda não possui uma sinopse disponível.";
    
    const baseMatch = item.vote_average ? Math.floor(item.vote_average * 10) : 85;
    document.getElementById('modal-match').innerText = `${baseMatch}% de correspondência`;
    
    const dataLancamento = item.release_date || item.first_air_date || '2026';
    document.getElementById('modal-year').innerText = dataLancamento.substring(0,4);

    // Ocultar seletor específico se for um filme (Filmes não têm temporadas na API do MyEmbed)
    const btnEspecifico = document.getElementById('btn-player-especifico');
    if (tipo === 'movie') {
        btnEspecifico.style.display = 'none';
    } else {
        btnEspecifico.style.display = 'inline-flex';
    }

    const btnList = document.getElementById('modal-watchlist-btn');
    if(biblioteca.watchlist[id]) {
        btnList.innerText = '✓ Na minha Lista';
        btnList.style.borderColor = '#46d369';
        btnList.style.color = '#46d369';
        btnList.style.background = 'rgba(70, 211, 105, 0.1)';
    } else {
        btnList.innerText = '+ Minha Lista';
        btnList.style.borderColor = 'rgba(255,255,255,0.4)';
        btnList.style.color = 'white';
        btnList.style.background = 'rgba(255,255,255,0.1)';
    }

    const dadosReview = biblioteca.reviews[id] || { rating: 0, text: "" };
    definirEstrelas(dadosReview.rating, false);
    document.getElementById('review-text').value = dadosReview.text;

    document.getElementById('detailsModal').style.display = 'flex';
    alternarScrollBody(true);
}

function fecharModal() { 
    document.getElementById('detailsModal').style.display = 'none'; 
    alternarScrollBody(false);
}

function toggleWatchlist() {
    const id = itemSelecionado.id;
    if(biblioteca.watchlist[id]) delete biblioteca.watchlist[id];
    else biblioteca.watchlist[id] = itemSelecionado;
    salvarDados();
    abrirModal(itemSelecionado); 
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
    const texto = document.getElementById('review-text').value;
    biblioteca.reviews[itemSelecionado.id] = { rating: estrelasAtivas, text: texto };
    salvarDados();
    alert("Anotação e avaliação salvas com sucesso no banco de dados!");
}

// ==========================================
// PLAYER DE VÍDEO INTEGRADO COM A API SOLICITADA (MYEMBED.BIZ)
// ==========================================
function abrirPlayerAtual(modo = 'geral') {
    if(!itemSelecionado) return;
    
    modoPlayerAtual = modo;
    const tipo = itemSelecionado.custom_type || (itemSelecionado.title ? 'movie' : 'tv'); 
    const modal = document.getElementById('playerModal');
    const epBox = document.getElementById('episodes-selectors-box');
    const player = document.getElementById('videoPlayer');

    // Regra da API: Se for série e o usuário clicou para escolher ep específico, mostra a barra de controle
    if (tipo === 'tv' && modo === 'especifico') {
        epBox.style.display = 'flex';
        player.style.height = '600px'; // Altura de episódio único
    } else if (tipo === 'tv' && modo === 'geral') {
        epBox.style.display = 'none';
        player.style.height = '700px'; // Recomendação da API para listagem completa de temporadas
    } else {
        epBox.style.display = 'none';
        player.style.height = '600px'; // Altura recomendada para Filmes
    }

    fecharModal(); 
    atualizarIframePlayer(); 
    
    modal.style.display = 'flex';
    alternarScrollBody(true);
}

function atualizarIframePlayer() {
    if (!itemSelecionado) return;
    
    const id = itemSelecionado.id;
    const tipo = itemSelecionado.custom_type || (itemSelecionado.title ? 'movie' : 'tv');
    const player = document.getElementById('videoPlayer');
    
    let urlDoVideo = "";

    if (tipo === 'movie') {
        // Estrutura de Filme da API
        urlDoVideo = `https://myembed.biz/filme/${id}`; 
    } else {
        if (modoPlayerAtual === 'geral') {
            // Estrutura de Série (Todas as Temporadas em Lista) da API
            urlDoVideo = `https://myembed.biz/serie/${id}`;
        } else {
            // Estrutura de Episódio Específico da API
            const season = document.getElementById('player-season-input').value || 1;
            const episode = document.getElementById('player-episode-input').value || 1;
            urlDoVideo = `https://myembed.biz/serie/${id}/${season}/${episode}`; 
        }
    }

    player.src = urlDoVideo;
}

function fecharPlayer() {
    document.getElementById('playerModal').style.display = 'none';
    document.getElementById('videoPlayer').src = "";
    alternarScrollBody(false);
}