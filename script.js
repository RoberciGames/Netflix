// ==========================================
// INFRAESTRUTURA CORE
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
let itemSelecionado = null;
let estrelasAtivas = 0;
let debounceTimer; 
let currentUserUID = null;
let modoPlayerAtual = 'geral';

let perfilUsuario = {
    username: "Utilizador",
    avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
};
let avatarTemp = "";

// ==========================================
// INSTANCIAÇÃO DO FIREBASE (NUVEM)
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

// ESCUTA DE SESSÃO
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUID = user.uid;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        
        db.collection("usuarios").doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                const data = doc.data();
                if(data.biblioteca) biblioteca = data.biblioteca;
                if(data.perfil) perfilUsuario = data.perfil;
            } else {
                recuperarCacheFallback(user);
            }
            atualizarInterfacePerfil();
            carregarDashboard();
        }).catch(() => {
            recuperarCacheFallback(user);
            atualizarInterfacePerfil();
            carregarDashboard(); 
        });
    } else {
        if (!currentUserUID) {
            currentUserUID = null;
            document.getElementById('main-app').style.display = 'none';
            document.getElementById('auth-screen').style.display = 'flex';
        }
    }
});

function entrarComoConvidado() {
    currentUserUID = null;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    
    biblioteca = JSON.parse(localStorage.getItem('cineNetflixLibV2')) || { watchlist: {}, reviews: {} };
    perfilUsuario = JSON.parse(localStorage.getItem('cineNetflixPerfil')) || { username: "Convidado", avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" };
    
    atualizarInterfacePerfil();
    carregarDashboard();
}

function recuperarCacheFallback(user) {
    biblioteca = JSON.parse(localStorage.getItem('cineNetflixLibV2')) || { watchlist: {}, reviews: {} };
    perfilUsuario = JSON.parse(localStorage.getItem('cineNetflixPerfil')) || { username: user ? user.email.split('@')[0] : "Utilizador", avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" };
}

function atualizarInterfacePerfil() {
    const pcTxt = document.getElementById('nav-username-txt-pc');
    const pcImg = document.getElementById('nav-avatar-img-pc');
    if(pcTxt) pcTxt.innerText = perfilUsuario.username;
    if(pcImg) pcImg.src = perfilUsuario.avatar;
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Entrar' : 'Registar';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'Entrar' : 'Criar Conta';
    document.getElementById('auth-switch-text').innerText = isLoginMode ? 'Novo por aqui?' : 'Já tem conta?';
    document.getElementById('auth-link').innerText = isLoginMode ? 'Registe-se agora.' : 'Entrar.';
    document.getElementById('auth-error').style.display = 'none';
}

function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorBox = document.getElementById('auth-error');
    const btn = document.getElementById('auth-btn');

    btn.innerText = "Aguarde..."; btn.disabled = true;
    errorBox.style.display = 'none';

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, pass).catch((error) => {
            errorBox.innerText = "Email ou palavra-passe incorretos. Tente novamente.";
            errorBox.style.display = 'block'; btn.disabled = false; btn.innerText = "Entrar";
        });
    } else {
        auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
            db.collection("usuarios").doc(userCredential.user.uid).set({
                email: email, 
                perfil: { username: email.split('@')[0], avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" },
                biblioteca: { watchlist: {}, reviews: {} }
            });
            btn.disabled = false;
        }).catch((error) => {
            errorBox.innerText = "Erro: " + error.message;
            errorBox.style.display = 'block'; btn.disabled = false; btn.innerText = "Criar Conta";
        });
    }
}

function fazerLogout() { 
    auth.signOut().then(() => {
        window.location.reload();
    }).catch(() => {
        window.location.reload();
    });
}

function salvarDados() {
    localStorage.setItem('cineNetflixLibV2', JSON.stringify(biblioteca)); 
    localStorage.setItem('cineNetflixPerfil', JSON.stringify(perfilUsuario)); 

    if (currentUserUID) {
        db.collection("usuarios").doc(currentUserUID).update({ 
            biblioteca: biblioteca,
            perfil: perfilUsuario 
        }).then(() => renderizarMinhaLista()).catch(() => renderizarMinhaLista());
    } else {
        renderizarMinhaLista();
    }
}

// ==========================================
// MÓDULO DE PERFIL E MODAIS
// ==========================================
function alternarScrollBody(travar) {
    if (travar) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
}

function abrirModalPerfil() {
    document.getElementById('edit-profile-username').value = perfilUsuario.username;
    avatarTemp = perfilUsuario.avatar;
    
    document.querySelectorAll('.selectable-avatar').forEach(img => {
        if(img.src === perfilUsuario.avatar) img.classList.add('active');
        else img.classList.remove('active');
    });

    document.getElementById('profileModal').style.display = 'flex';
    alternarScrollBody(true);
}

function fecharModalPerfil() {
    document.getElementById('profileModal').style.display = 'none';
    alternarScrollBody(false);
}

function selecionarAvatarNoModal(elemento, url) {
    document.querySelectorAll('.selectable-avatar').forEach(img => img.classList.remove('active'));
    elemento.classList.add('active');
    avatarTemp = url;
}

function guardarAlteracoesPerfil() {
    const novoNome = document.getElementById('edit-profile-username').value.trim();
    if(!novoNome) { alert("Nome inválido."); return; }
    
    perfilUsuario.username = novoNome;
    perfilUsuario.avatar = avatarTemp;
    
    atualizarInterfacePerfil();
    salvarDados();
    fecharModalPerfil();
}

// ==========================================
// ENGINE DE CARROSSEIS + CONTADOR HUD
// ==========================================
function injetarEstruturaRow(idContainer, tituloRow) {
    const wrapper = document.getElementById('rows-wrapper-layout');
    if (!wrapper || document.getElementById(`${idContainer}-section`)) return;
    
    const rowHtml = `
        <div class="movie-row" id="${idContainer}-section">
            <div class="row-header">
                <h2 class="section-title">${tituloRow}</h2>
                <span class="row-counter" id="count-${idContainer}">SINC...</span>
            </div>
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

function filtrarCatalogo(idSection, event) {
    if(event) {
        document.querySelectorAll('.catalog-btn').forEach(btn => btn.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }

    const sections = ['row-movies', 'row-series', 'row-animes', 'row-cartoons', 'row-watchlist'];
    
    sections.forEach(secId => {
        const el = document.getElementById(`${secId}-section`);
        if (!el) return;
        
        if (idSection === 'todos') {
            if (secId === 'row-watchlist') {
                const itens = Object.values(biblioteca.watchlist);
                el.style.display = itens.length === 0 ? 'none' : 'block';
            } else {
                el.style.display = 'block';
            }
        } else {
            if (secId === idSection) el.style.display = 'block';
            else el.style.display = 'none';
        }
    });
}

async function montarPostersMultiPage(urls, targetId, tipoFixo) {
    const container = document.getElementById(targetId);
    if(!container) return;
    container.innerHTML = ''; 

    let totalItemsCarregados = 0;
    let sucessoAPI = false;

    for (let url of urls) {
        try {
            const res = await fetch(url);
            if(!res.ok) throw new Error();
            const data = await res.json();
            if(!data.results || data.results.length === 0) continue;

            sucessoAPI = true;
            data.results.forEach(item => {
                if(!item.poster_path) return;
                
                totalItemsCarregados++;
                item.custom_type = tipoFixo || item.media_type || (item.name ? 'tv' : 'movie');
                
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.onclick = () => abrirModal(item);
                
                const estaNaLista = biblioteca.watchlist[item.id] ? `<div class="watched-bar"></div>` : "";
                card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${item.title || item.name}" loading="lazy">${estaNaLista}`;
                container.appendChild(card);
            });
        } catch (err) { }
    }

    const counterEl = document.getElementById(`count-${targetId}`);
    if(counterEl) {
        counterEl.innerText = `[ ${totalItemsCarregados} ARQUIVOS ]`;
    }
}

async function carregarDashboard() {
    injetarEstruturaRow('row-movies', '🎬 Filmes em Destaque');
    injetarEstruturaRow('row-series', '📺 Séries e Produções');
    injetarEstruturaRow('row-animes', '🗡️ Universo Anime');
    injetarEstruturaRow('row-cartoons', '🎨 Desenhos Clássicos');
    injetarEstruturaRow('row-watchlist', '⭐ A Minha Lista');

    try {
        const resTrending = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-PT`);
        const dataTrending = await resTrending.json();
        if(dataTrending.results && dataTrending.results.length > 0) configurarHero(dataTrending.results[0]);
    } catch(e) {}

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-PT&page=1`,
        `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=pt-PT&with_genres=28&page=1`
    ], 'row-movies', 'movie');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-PT&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-PT&with_genres=18&page=1`
    ], 'row-series', 'tv');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-PT&with_genres=16&with_original_language=ja&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-PT&with_genres=16&with_original_language=ja&page=2`
    ], 'row-animes', 'tv');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-PT&with_genres=16&with_original_language=en&page=1`
    ], 'row-cartoons', 'tv');

    renderizarMinhaLista();
}

function configurarHero(item) {
    const banner = document.getElementById('hero-banner');
    if(!banner) return;
    
    if (item.backdrop_path) {
        banner.style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path}')`;
    } 
    
    document.getElementById('hero-title').innerText = item.title || item.name;
    document.getElementById('hero-synopsis').innerText = item.overview ? item.overview.substring(0, 180) + "..." : "Sinopse indisponível.";
    
    item.custom_type = item.media_type || (item.name ? 'tv' : 'movie');
    document.getElementById('hero-play-btn').onclick = () => { itemSelecionado = item; abrirPlayerAtual('geral'); };
}

function renderizarMinhaLista() {
    const container = document.getElementById('row-watchlist');
    const section = document.getElementById('row-watchlist-section');
    if(!container || !section) return;

    const itens = Object.values(biblioteca.watchlist).reverse();
    const counterEl = document.getElementById(`count-row-watchlist`);

    if(itens.length === 0) { 
        section.style.display = 'none'; 
        if(counterEl) counterEl.innerText = "[ 0 ARQUIVOS ]";
        return; 
    }

    const activeBtn = document.querySelector('.catalog-btn.active');
    if (!activeBtn || activeBtn.getAttribute('onclick').includes('todos') || activeBtn.getAttribute('onclick').includes('row-watchlist')) {
        section.style.display = 'block';
    }
    
    if(counterEl) counterEl.innerText = `[ ${itens.length} ARQUIVOS ]`;
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
// CONTROLO DE FILTRAGEM E BUSCA
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
    grid.innerHTML = '<p style="color: #fff; padding: 20px;">A pesquisar nos servidores...</p>';

    try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=pt-PT&query=${encodeURIComponent(termo)}`);
        const data = await res.json();
        const filtrados = data.results.filter(i => i.media_type !== 'person' && (i.poster_path || i.id));
        
        grid.innerHTML = '';
        if(filtrados.length === 0) { grid.innerHTML = '<p style="color: #666; padding: 20px;">Nenhum registo encontrado.</p>'; return; }

        filtrados.forEach(item => {
            item.custom_type = item.media_type || (item.name ? 'tv' : 'movie');
            const card = document.createElement('div');
            card.className = 'movie-card'; card.style.width = '100%';
            card.onclick = () => abrirModal(item);
            
            if (item.poster_path) {
                card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}">`;
            } else {
                card.innerHTML = `
                    <div style="background:#111; height:100%; display:flex; align-items:center; justify-content:center; text-align:center; padding:10px; font-size:12px;">${item.title || item.name}</div>
                `;
            }
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
// MODAL DE DETALHES
// ==========================================
function abrirModal(item) {
    itemSelecionado = item;
    const id = item.id;
    const tipo = item.custom_type;

    const modalBg = document.getElementById('modal-hero-bg');
    if (item.backdrop_path || item.poster_path) {
        modalBg.style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}')`;
    } 
    
    document.getElementById('modal-title').innerText = item.title || item.name;
    document.getElementById('modal-desc').innerText = item.overview || "Sem descrição disponível.";
    
    const baseMatch = item.vote_average ? Math.floor(item.vote_average * 10) : 88;
    document.getElementById('modal-match').innerText = `${baseMatch}% de Match`;
    document.getElementById('modal-year').innerText = (item.release_date || item.first_air_date || '2026').substring(0,4);

    const btnEspecifico = document.getElementById('btn-player-especifico');
    if (btnEspecifico) btnEspecifico.style.display = (tipo === 'movie') ? 'none' : 'inline-flex';

    const btnList = document.getElementById('modal-watchlist-btn');
    if(biblioteca.watchlist[id]) {
        btnList.innerText = '✓ Na Minha Lista';
        btnList.style.borderColor = '#46d369'; btnList.style.color = '#46d369'; btnList.style.background = 'transparent';
    } else {
        btnList.innerText = '+ A Minha Lista';
        btnList.style.borderColor = 'rgba(255,255,255,0.4)'; btnList.style.color = 'white'; btnList.style.background = 'transparent';
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
    
    salvarDados(); abrirModal(itemSelecionado); 
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
    salvarDados(); alert("Avaliação guardada com sucesso.");
}

// ==========================================
// REPRODUTOR API NATIVA (MGEB.TOP COM EFEITO NETFLIX)
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

    // Usando a API mgeb.top com a cor Vermelha estilo Netflix (e50914)
    if (tipo === 'movie') {
        player.src = `https://mgeb.top/embed/${id}#color:e50914`; 
    } else {
        if (modoPlayerAtual === 'geral') {
            player.src = `https://mgeb.top/embed/${id}#color:e50914`;
        } else {
            const season = document.getElementById('player-season-input').value || 1;
            const episode = document.getElementById('player-episode-input').value || 1;
            player.src = `https://mgeb.top/embed/${id}/${season}/${episode}#color:e50914`; 
        }
    }
}

function fecharPlayer() {
    document.getElementById('playerModal').style.display = 'none';
    document.getElementById('videoPlayer').src = "";
    alternarScrollBody(false);
}

// Sincronizador de abas ativas
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