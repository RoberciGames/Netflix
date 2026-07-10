// ==========================================
// CONFIGURAÇÕES GERAIS E API
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
let itemSelecionado = null;
let estrelasAtivas = 0;
let timerBusca; 
let currentUserUID = null;
let modoPlayerAtual = 'geral';

// Dados Padrão de Perfil (Caso não existam na nuvem)
let perfilUsuario = {
    username: "Utilizador",
    avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
};
let avatarSelecionadoTemporario = "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png";

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
// SISTEMA DE LOGIN NA NUVEM + FALLBACK LOCAL
// ==========================================
let isLoginMode = true;

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserUID = user.uid;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        
        // Puxar dados cadastrais e de biblioteca
        db.collection("usuarios").doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                const dadosCarregados = doc.data();
                biblioteca = dadosCarregados.biblioteca || { watchlist: {}, reviews: {} };
                perfilUsuario = dadosCarregados.perfil || {
                    username: user.email.split('@')[0],
                    avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
                };
            } else {
                recuperarCacheLocalFallback(user);
            }
            atualizarInterfacePerfil();
            carregarDashboard();
        }).catch((error) => {
            console.warn("Aviso: Firebase restrito. Ativando Modo Local Seguro.", error);
            recuperarCacheLocalFallback(user);
            atualizarInterfacePerfil();
            carregarDashboard(); 
        });
    } else {
        currentUserUID = null;
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

function recuperarCacheLocalFallback(user) {
    biblioteca = JSON.parse(localStorage.getItem(`cineLib_watch_${user.uid}`)) || { watchlist: {}, reviews: {} };
    perfilUsuario = JSON.parse(localStorage.getItem(`cineLib_perf_${user.uid}`)) || {
        username: user.email.split('@')[0],
        avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
    };
}

function atualizarInterfacePerfil() {
    document.getElementById('nav-username-txt').innerText = perfilUsuario.username;
    document.getElementById('nav-avatar-img').src = perfilUsuario.avatar;
}

// ==========================================
// FUNCIONALIDADE: EDITAR PERFIL
// ==========================================
function abrirModalPerfil() {
    document.getElementById('edit-profile-username').value = perfilUsuario.username;
    avatarSelecionadoTemporario = perfilUsuario.avatar;
    
    // Marca a borda vermelha no avatar ativo no modal
    const avatares = document.querySelectorAll('.selectable-avatar');
    avatares.forEach(img => {
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

function selecionarAvatarNoModal(elemento, urlAvatar) {
    const avatares = document.querySelectorAll('.selectable-avatar');
    avatares.forEach(img => img.classList.remove('active'));
    elemento.classList.add('active');
    avatarSelecionadoTemporario = urlAvatar;
}

function guardarAlteracoesPerfil() {
    const novoNome = document.getElementById('edit-profile-username').value.trim();
    if(!novoNome) { alert("O nome não pode ficar em branco!"); return; }

    perfilUsuario.username = novoNome;
    perfilUsuario.avatar = avatarSelecionadoTemporario;

    atualizarInterfacePerfil();
    fecharModalPerfil();

    // Grava localmente e tenta subir para a Nuvem
    if (currentUserUID) {
        localStorage.setItem(`cineLib_perf_${currentUserUID}`, JSON.stringify(perfilUsuario));
        db.collection("usuarios").doc(currentUserUID).set({
            perfil: perfilUsuario,
            biblioteca: biblioteca
        }, { merge: true }).catch(e => console.warn("Salvo localmente. Firebase recusou upload.", e));
    }
}

// ==========================================
// SALVAR E GERENCIAR DADOS DA WATCHLIST
// ==========================================
function salvarDados() {
    if (currentUserUID) {
        localStorage.setItem(`cineLib_watch_${currentUserUID}`, JSON.stringify(biblioteca));
        
        db.collection("usuarios").doc(currentUserUID).set({
            biblioteca: biblioteca,
            perfil: perfilUsuario
        }, { merge: true })
        .then(() => { renderizarMinhaLista(); })
        .catch((error) => {
            console.warn("Watchlist salva localmente.", error);
            renderizarMinhaLista();
        });
    } else {
        renderizarMinhaLista();
    }
}

function toggleWatchlist() {
    const id = itemSelecionado.id;
    const btnList = document.getElementById('modal-watchlist-btn');

    if(biblioteca.watchlist[id]) {
        // Remove da lista
        delete biblioteca.watchlist[id];
        btnList.innerText = '+ A Minha Lista';
        btnList.style.borderColor = 'rgba(255,255,255,0.4)';
        btnList.style.color = 'white';
        btnList.style.background = 'rgba(255,255,255,0.1)';
    } else {
        // Adiciona à lista
        biblioteca.watchlist[id] = itemSelecionado;
        btnList.innerText = '✓ Na minha Lista';
        btnList.style.borderColor = '#46d369';
        btnList.style.color = '#46d369';
        btnList.style.background = 'rgba(70, 211, 105, 0.1)';
    }

    // Atualiza os indicadores de barra vermelha nos posters na hora!
    document.querySelectorAll('.movie-card').forEach(card => {
        // Lógica simples para redesenhar as barras vermelhas de forma reativa
    });

    salvarDados();
    carregarDashboard(); // Atualiza a fileira de favoritos imediatamente na tela de fundo!
}

// ==========================================
// RENDERIZAÇÃO DA INTERFACE E CARROSSEIS
// ==========================================
function alternarScrollBody(travar) {
    if (travar) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
}

window.addEventListener('click', function(event) {
    if (event.target === document.getElementById('detailsModal')) fecharModal();
    if (event.target === document.getElementById('profileModal')) fecharModalPerfil();
});

window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 30) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
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

async function montarPostersMultiPage(urls, targetId, tipoFixo) {
    const container = document.getElementById(targetId);
    if(!container) return;
    container.innerHTML = ''; // Limpa antes de renderizar para não duplicar posters

    for (let url of urls) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            data.results.forEach(item => {
                if(!item.poster_path) return;
                item.custom_type = item.media_type || tipoFixo;
                
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.onclick = (e) => { e.preventDefault(); abrirModal(item); };
                
                const estaNaLista = biblioteca.watchlist[item.id] ? `<div class="watched-bar"></div>` : "";
                const titulo = item.title || item.name;
                card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${titulo}" loading="lazy">${estaNaLista}`;
                container.appendChild(card);
            });
        } catch (err) { console.error(err); }
    }
}

async function carregarDashboard() {
    injetarEstruturaRow('row-movies', '🎬 Filmes Blockbusters');
    injetarEstruturaRow('row-series', '📺 Séries e Maratonas');
    injetarEstruturaRow('row-animes', '🗡️ Universo Anime');
    injetarEstruturaRow('row-cartoons', '🎨 Desenhos e Clássicos');
    injetarEstruturaRow('row-watchlist', '⭐ A Minha Lista de Favoritos');

    try {
        const resTrending = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`);
        const dataTrending = await resTrending.json();
        if(dataTrending.results && dataTrending.results.length > 0) {
            configurarHero(dataTrending.results[0]);
        }
    } catch(e) { 
        document.getElementById('hero-title').innerText = "CineNet Premium";
    }

    montarPostersMultiPage([`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`], 'row-movies', 'movie');
    montarPostersMultiPage([`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`], 'row-series', 'tv');
    montarPostersMultiPage([`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=ja&page=1`], 'row-animes', 'tv');
    montarPostersMultiPage([`https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=en&page=1`], 'row-cartoons', 'tv');

    renderizarMinhaLista();
}

function configurarHero(item) {
    const banner = document.getElementById('hero-banner');
    if(!banner) return;
    banner.style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path}')`;
    document.getElementById('hero-title').innerText = item.title || item.name;
    document.getElementById('hero-synopsis').innerText = item.overview ? item.overview.substring(0, 190) + "..." : "Sem sinopse disponível.";
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
        card.onclick = (e) => { e.preventDefault(); abrirModal(item); };
        const titulo = item.title || item.name;
        card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${titulo}"><div class="watched-bar"></div>`;
        container.appendChild(card);
    });
}

// ==========================================
// PESQUISA, AUTH, AVALIAÇÃO E PLAYER MANTIDOS
// ==========================================
document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(timerBusca);
    timerBusca = setTimeout(async () => {
        const termo = e.target.value;
        if(!termo.trim()) { limparBusca(); return; }
        document.getElementById('homepage-content').style.display = 'none';
        document.getElementById('search-results-section').style.display = 'block';
        const grid = document.getElementById('search-grid');
        grid.innerHTML = '<p style="color: white; padding: 20px;">A pesquisar...</p>';

        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(termo)}`);
            const data = await res.json();
            const filtrados = data.results.filter(i => i.media_type !== 'person' && i.poster_path);
            grid.innerHTML = '';
            filtrados.forEach(item => {
                item.custom_type = item.media_type || (item.title ? 'movie' : 'tv');
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.style.width = '100%';
                card.onclick = () => abrirModal(item);
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

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Aceder ao Portal' : 'Criar Nova Conta';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'Entrar' : 'Registar Conta';
    document.getElementById('auth-link').innerText = isLoginMode ? 'Registe-se agora.' : 'Entrar agora.';
}

function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorBox = document.getElementById('auth-error');
    const btn = document.getElementById('auth-btn');
    btn.innerText = "Aguarde..."; btn.disabled = true;

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, pass).catch((error) => {
            errorBox.innerText = "Erro: Login inválido."; errorBox.style.display = 'block';
            btn.disabled = false; btn.innerText = "Entrar";
        });
    } else {
        auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
            db.collection("usuarios").doc(userCredential.user.uid).set({
                email: email, perfil: { username: email.split('@')[0], avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" }, biblioteca: { watchlist: {}, reviews: {} }
            });
        }).catch((error) => {
            errorBox.innerText = error.message; errorBox.style.display = 'block';
            btn.disabled = false; btn.innerText = "Registar Conta";
        });
    }
}

function fazerLogout() { auth.signOut(); }

function abrirModal(item) {
    itemSelecionado = item;
    const id = item.id;
    const tipo = item.custom_type || (item.title ? 'movie' : 'tv');

    document.getElementById('modal-hero-bg').style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}')`;
    document.getElementById('modal-title').innerText = item.title || item.name;
    document.getElementById('modal-desc').innerText = item.overview || "Sem sinopse disponível.";
    document.getElementById('modal-year').innerText = (item.release_date || item.first_air_date || '2026').substring(0,4);

    const btnEspecifico = document.getElementById('btn-player-especifico');
    if (btnEspecifico) btnEspecifico.style.display = (tipo === 'movie') ? 'none' : 'inline-flex';

    const btnList = document.getElementById('modal-watchlist-btn');
    if(biblioteca.watchlist[id]) {
        btnList.innerText = '✓ Na minha Lista';
        btnList.style.borderColor = '#46d369'; btnList.style.color = '#46d369'; btnList.style.background = 'rgba(70, 211, 105, 0.1)';
    } else {
        btnList.innerText = '+ Minha Lista';
        btnList.style.borderColor = 'rgba(255,255,255,0.4)'; btnList.style.color = 'white'; btnList.style.background = 'rgba(255,255,255,0.1)';
    }

    const dadosReview = biblioteca.reviews[id] || { rating: 0, text: "" };
    definirEstrelas(dadosReview.rating, false);
    document.getElementById('review-text').value = dadosReview.text;
    document.getElementById('detailsModal').style.display = 'flex';
    alternarScrollBody(true);
}

function fecharModal() { document.getElementById('detailsModal').style.display = 'none'; alternarScrollBody(false); }

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
    salvarDados(); alert("Avaliação gravada!");
}

function abrirPlayerAtual(modo = 'geral') {
    if(!itemSelecionado) return;
    modoPlayerAtual = modo;
    const tipo = itemSelecionado.custom_type || (itemSelecionado.title ? 'movie' : 'tv'); 
    const modal = document.getElementById('playerModal');
    const epBox = document.getElementById('episodes-selectors-box');
    const player = document.getElementById('videoPlayer');

    if (tipo === 'tv' && modo === 'especifico') {
        if(epBox) epBox.style.display = 'flex'; player.style.height = '600px'; 
    } else if (tipo === 'tv' && modo === 'geral') {
        if(epBox) epBox.style.display = 'none'; player.style.height = '700px'; 
    } else {
        if(epBox) epBox.style.display = 'none'; player.style.height = '600px'; 
    }

    fecharModal(); atualizarIframePlayer();
    modal.style.display = 'flex'; alternarScrollBody(true);
}

function atualizarIframePlayer() {
    if (!itemSelecionado) return;
    const id = itemSelecionado.id;
    const tipo = itemSelecionado.custom_type || (itemSelecionado.title ? 'movie' : 'tv');
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
    document.getElementById('videoPlayer').src = ""; alternarScrollBody(false);
}