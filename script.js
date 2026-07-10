// ==========================================
// CONFIGURAÇÕES GERAIS E API (TMDB)
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
let itemSelecionado = null;
let estrelasAtivas = 0;
let timerBusca; 
let currentUserUID = null;
let modoPlayerAtual = 'geral';

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

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
let biblioteca = { watchlist: {}, reviews: {} };

// ==========================================
// AUTENTICAÇÃO E RECUPERAÇÃO DE DADOS (C/ FALLBACK)
// ==========================================
let isLoginMode = true;

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUID = user.uid;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        
        // Puxa da Nuvem. Se falhar, usa localStorage
        db.collection("usuarios").doc(user.uid).get().then((doc) => {
            if (doc.exists) biblioteca = doc.data().biblioteca || { watchlist: {}, reviews: {} };
            else biblioteca = JSON.parse(localStorage.getItem('cineNetflixLibV2')) || { watchlist: {}, reviews: {} };
            carregarDashboard();
        }).catch((error) => {
            console.warn("Aviso: Firebase Offline. Usando modo Local.", error);
            biblioteca = JSON.parse(localStorage.getItem('cineNetflixLibV2')) || { watchlist: {}, reviews: {} };
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
    document.getElementById('auth-title').innerText = isLoginMode ? 'SISTEMA CINENET' : 'REGISTO NO SISTEMA';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'INICIAR SESSÃO' : 'CRIAR ACESSO';
    document.getElementById('auth-link').innerText = isLoginMode ? 'Solicitar credenciais.' : 'Já tenho acesso.';
    document.getElementById('auth-error').style.display = 'none';
}

function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorBox = document.getElementById('auth-error');
    const btn = document.getElementById('auth-btn');

    btn.innerText = "A PROCESSAR..."; btn.disabled = true;

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, pass).catch((error) => {
            errorBox.innerText = "Acesso Negado: Credenciais inválidas.";
            errorBox.style.display = 'block';
            btn.disabled = false; btn.innerText = "INICIAR SESSÃO";
        });
    } else {
        auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
            db.collection("usuarios").doc(userCredential.user.uid).set({
                email: email, biblioteca: { watchlist: {}, reviews: {} }
            }).catch(e => console.warn("Erro ao criar perfil no BD, seguindo...", e));
            btn.disabled = false;
        }).catch((error) => {
            errorBox.innerText = "Erro: " + error.message;
            errorBox.style.display = 'block';
            btn.disabled = false; btn.innerText = "CRIAR ACESSO";
        });
    }
}

function fazerLogout() { auth.signOut(); }

function salvarDados() {
    localStorage.setItem('cineNetflixLibV2', JSON.stringify(biblioteca)); 
    if (currentUserUID) {
        db.collection("usuarios").doc(currentUserUID).update({ biblioteca: biblioteca })
        .then(() => renderizarMinhaLista())
        .catch(() => renderizarMinhaLista());
    } else {
        renderizarMinhaLista();
    }
}

// ==========================================
// CONSTRUÇÃO DO CATÁLOGO (ANIMAÇÕES E FILEIRAS)
// ==========================================
function alternarScrollBody(travar) {
    if (travar) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
}

window.addEventListener('click', function(event) {
    const detailsModal = document.getElementById('detailsModal');
    if (event.target === detailsModal) fecharModal();
});

function injetarEstruturaRow(idContainer, tituloRow) {
    const wrapper = document.getElementById('rows-wrapper-layout');
    if (!wrapper || document.getElementById(`${idContainer}-section`)) return;
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

// Função que puxa VÁRIAS páginas da API para dar MUITA variedade
async function montarPostersMultiPage(urls, targetId, tipoFixo) {
    const container = document.getElementById(targetId);
    if(!container) return;
    container.innerHTML = ''; 

    for (let url of urls) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            data.results.forEach(item => {
                if(!item.poster_path) return;
                
                // CORREÇÃO CRÍTICA DO BUG DE SÉRIES! (Obriga a definir como TV ou Movie baseando na categoria)
                item.custom_type = tipoFixo || item.media_type || (item.name ? 'tv' : 'movie');
                
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

    // Cria as Divisórias (Os IDs ligam-se perfeitamente aos Links da Nav Superior)
    injetarEstruturaRow('row-movies', '🎬 Filmes Globais');
    injetarEstruturaRow('row-series', '📺 Séries e Maratonas');
    injetarEstruturaRow('row-animes', '🗡️ Universo Anime');
    injetarEstruturaRow('row-cartoons', '🎨 Desenhos e Animação');
    injetarEstruturaRow('row-watchlist', '⭐ A Minha Lista');

    // Carrega o Hero Banner
    try {
        const resTrending = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`);
        const dataTrending = await resTrending.json();
        if(dataTrending.results && dataTrending.results.length > 0) configurarHero(dataTrending.results[0]);
    } catch(e) { console.error(e); }

    // Preenche as fileiras com VÁRIAS PÁGINAS (garante dezenas de itens por categoria)
    montarPostersMultiPage([
        `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`,
        `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=pt-BR&with_genres=28&page=1`,
        `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=pt-BR&with_genres=878&page=1`
    ], 'row-movies', 'movie');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=18&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=80&page=1`
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
    if(!banner) return;
    banner.style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path}')`;
    document.getElementById('hero-title').innerText = item.title || item.name;
    document.getElementById('hero-synopsis').innerText = item.overview ? item.overview.substring(0, 200) + "..." : "Sem sinopse disponível.";
    
    // Assegura que o Hero tem o tipo correto
    item.custom_type = item.media_type || (item.name ? 'tv' : 'movie');
    
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

        home.style.display = 'none'; searchSection.style.display = 'block';
        grid.innerHTML = '<p style="color: var(--neon-red); padding: 20px;">A pesquisar nos servidores...</p>';

        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(termo)}`);
            const data = await res.json();
            const filtrados = data.results.filter(i => i.media_type !== 'person' && i.poster_path);
            
            grid.innerHTML = '';
            if(filtrados.length === 0) {
                grid.innerHTML = '<p style="color: #888; padding: 20px;">Nenhum conteúdo encontrado.</p>'; return;
            }

            filtrados.forEach(item => {
                item.custom_type = item.media_type || (item.name ? 'tv' : 'movie');
                const card = document.createElement('div');
                card.className = 'movie-card'; card.style.width = '100%';
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
// MODAL DE INFORMAÇÃO E AVALIAÇÃO (GLASS)
// ==========================================
function abrirModal(item) {
    itemSelecionado = item;
    const id = item.id;
    const tipo = item.custom_type;

    document.getElementById('modal-hero-bg').style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}')`;
    document.getElementById('modal-title').innerText = item.title || item.name;
    document.getElementById('modal-desc').innerText = item.overview || "Ficheiro confidencial. Sem sinopse.";
    
    const baseMatch = item.vote_average ? Math.floor(item.vote_average * 10) : 85;
    document.getElementById('modal-match').innerText = `${baseMatch}% de Relevância`;
    document.getElementById('modal-year').innerText = (item.release_date || item.first_air_date || '2026').substring(0,4);

    const btnEspecifico = document.getElementById('btn-player-especifico');
    if (tipo === 'movie') {
        if(btnEspecifico) btnEspecifico.style.display = 'none';
    } else {
        if(btnEspecifico) btnEspecifico.style.display = 'inline-flex';
    }

    const btnList = document.getElementById('modal-watchlist-btn');
    if(biblioteca.watchlist[id]) {
        btnList.innerText = '✓ Na Minha Lista';
        btnList.style.borderColor = '#00ff88'; btnList.style.color = '#00ff88'; btnList.style.background = 'rgba(0, 255, 136, 0.1)';
    } else {
        btnList.innerText = '+ A Minha Lista';
        btnList.style.borderColor = 'rgba(255,255,255,0.4)'; btnList.style.color = 'white'; btnList.style.background = 'rgba(255,255,255,0.05)';
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
    
    salvarDados(); 
    abrirModal(itemSelecionado); 
    carregarDashboard(); // Força atualização visual da barra vermelha
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
    alert("Dados Gravados nos Servidores!");
}

// ==========================================
// PLAYER DE VÍDEO (API: MYEMBED.BIZ)
// ==========================================
function abrirPlayerAtual(modo = 'geral') {
    if(!itemSelecionado) return;
    
    modoPlayerAtual = modo;
    const tipo = itemSelecionado.custom_type; 
    const modal = document.getElementById('playerModal');
    const epBox = document.getElementById('episodes-selectors-box');
    const player = document.getElementById('videoPlayer');

    // Regras visuais baseadas na documentação do myembed.biz
    if (tipo === 'tv' && modo === 'especifico') {
        if(epBox) epBox.style.display = 'flex';
        player.style.height = '600px'; 
    } else if (tipo === 'tv' && modo === 'geral') {
        if(epBox) epBox.style.display = 'none';
        player.style.height = '700px'; // Altura sugerida para listagem de temporadas
    } else {
        if(epBox) epBox.style.display = 'none';
        player.style.height = '600px'; // Altura padrão filme
    }

    fecharModal(); 
    atualizarIframePlayer(); 
    
    modal.style.display = 'flex';
    alternarScrollBody(true);
}

function atualizarIframePlayer() {
    if (!itemSelecionado) return;
    
    const id = itemSelecionado.id;
    const tipo = itemSelecionado.custom_type;
    const player = document.getElementById('videoPlayer');
    
    let urlDoVideo = "";

    if (tipo === 'movie') {
        urlDoVideo = `https://myembed.biz/filme/${id}`; 
    } else {
        if (modoPlayerAtual === 'geral') {
            urlDoVideo = `https://myembed.biz/serie/${id}`;
        } else {
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