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

// VARIÁVEIS DO PLAYER (Corrigidas)
let modoPlayerAtual = 'geral';
const corDestaque = 'e50914';

let perfilUsuario = {
    username: "Operador",
    avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
};
let avatarTemp = "";
let biblioteca = { watchlist: {}, reviews: {} };
let isLoginMode = true;

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

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

function alternarScrollBody(bloquear) {
    if (bloquear) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = `${scrollbarWidth}px`;
        document.body.classList.add('modal-open');
    } else {
        document.body.style.paddingRight = '0px';
        document.body.classList.remove('modal-open');
    }
}

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
            }
            atualizarInterfacePerfil();
            carregarDashboard();
        }).catch(() => { carregarDashboard(); });
    } else {
        currentUserUID = null;
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
    }
});

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Entrar' : 'Criar Conta';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'Entrar' : 'Registar';
    document.getElementById('auth-switch-text').innerText = isLoginMode ? 'Novo por aqui?' : 'Já possui conta?';
    document.getElementById('auth-link').innerText = isLoginMode ? 'Assine agora.' : 'Faça login.';
    document.getElementById('auth-error').style.display = 'none';
}

function handleAuth(event) {
    event.preventDefault();
    const email = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorBox = document.getElementById('auth-error');
    const btn = document.getElementById('auth-btn');

    btn.innerText = "Aguarde..."; btn.disabled = true; errorBox.style.display = 'none';

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, pass).catch((error) => {
            errorBox.innerText = "Credenciais inválidas. Tente novamente.";
            errorBox.style.display = 'block'; btn.disabled = false; btn.innerText = "Entrar";
        });
    } else {
        auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
            db.collection("usuarios").doc(userCredential.user.uid).set({
                email: email, 
                perfil: { username: email.split('@')[0], avatar: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png" },
                biblioteca: { watchlist: {}, reviews: {} }
            });
        }).catch((error) => {
            errorBox.innerText = "Erro: " + error.message;
            errorBox.style.display = 'block'; btn.disabled = false; btn.innerText = "Registar";
        });
    }
}

function fazerLogout() { auth.signOut().then(() => { window.location.reload(); }); }

function salvarDados() {
    if (currentUserUID) {
        db.collection("usuarios").doc(currentUserUID).update({ biblioteca: biblioteca, perfil: perfilUsuario })
          .then(() => renderizarMinhaLista()).catch(() => renderizarMinhaLista());
    }
}

// ==========================================
// SISTEMA DE PERFIL 2.0 (AVATAR CUSTOMIZADO)
// ==========================================
function atualizarInterfacePerfil() {
    document.querySelectorAll('.display-username').forEach(el => el.innerText = perfilUsuario.username);
    document.querySelectorAll('.display-avatar').forEach(el => el.src = perfilUsuario.avatar);
}

function abrirModalPerfil() {
    document.getElementById('input-profile-username').value = perfilUsuario.username;
    document.getElementById('input-profile-avatar-url').value = ""; // Limpa a URL customizada
    avatarTemp = perfilUsuario.avatar;
    
    // Marca o avatar caso seja um dos pré-definidos
    document.querySelectorAll('.avatar-option').forEach(img => {
        img.classList.toggle('active', img.src === perfilUsuario.avatar);
    });

    document.getElementById('profileModal').style.display = 'flex';
    alternarScrollBody(true);
}

function fecharModalPerfil() { document.getElementById('profileModal').style.display = 'none'; alternarScrollBody(false); }

function selecionarAvatarLocal(elemento) {
    // Quando escolhe um pronto, limpa o campo de URL
    document.getElementById('input-profile-avatar-url').value = "";
    document.querySelectorAll('.avatar-option').forEach(img => img.classList.remove('active'));
    elemento.classList.add('active'); 
    avatarTemp = elemento.src;
}

function limparSelecaoAvatar() {
    // Quando digita uma URL, desmarca as imagens prontas
    document.querySelectorAll('.avatar-option').forEach(img => img.classList.remove('active'));
}

function salvarConfiguracoesPerfil() {
    const novoNome = document.getElementById('input-profile-username').value.trim();
    const urlCustomizada = document.getElementById('input-profile-avatar-url').value.trim();
    
    if(!novoNome) { alert("O nome não pode estar vazio."); return; }
    
    perfilUsuario.username = novoNome; 
    
    // Se o user digitou uma URL, usa ela, senão usa o avatar selecionado
    if(urlCustomizada !== "") {
        perfilUsuario.avatar = urlCustomizada;
    } else {
        perfilUsuario.avatar = avatarTemp;
    }

    atualizarInterfacePerfil(); 
    salvarDados(); 
    fecharModalPerfil();
}

// ==========================================
// RENDERIZAÇÃO DE VITRINES (CARROUSSEL)
// ==========================================
function injetarEstruturaRow(idContainer, tituloRow) {
    const wrapper = document.getElementById('rows-wrapper-layout');
    if (!wrapper || document.getElementById(`${idContainer}-section`)) return;
    
    const rowHtml = `
        <section class="movie-section" id="${idContainer}-section">
            <h2 class="section-title">${tituloRow}</h2>
            <div class="movie-row" id="${idContainer}"></div>
        </section>
    `;
    wrapper.insertAdjacentHTML('beforeend', rowHtml);
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
                item.custom_type = tipoFixo || item.media_type || (item.name ? 'tv' : 'movie');
                
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.onclick = () => exibirPretelaDetalhes(item.id, item.custom_type);
                
                const estaNaLista = biblioteca.watchlist[item.id] ? `<div class="watched-indicator">✓</div>` : "";
                card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}" loading="lazy">${estaNaLista}`;
                container.appendChild(card);
            });
        } catch (err) { console.error(err); }
    }
}

async function carregarDashboard() {
    injetarEstruturaRow('row-movies', '🎬 Filmes em Destaque');
    injetarEstruturaRow('row-series', '📺 Séries Imperdíveis');
    injetarEstruturaRow('row-animes', '💥 Animes & Animações Japonesas');
    injetarEstruturaRow('row-cartoons', '🧸 Desenhos Animados Clássicos');
    injetarEstruturaRow('row-watchlist', '⭐ Minha Lista');

    try {
        const res = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`);
        const data = await res.json();
        if(data.results[0]) configurarHero(data.results[0]);
    } catch(e) {}

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
    document.getElementById('hero-synopsis').innerText = item.overview ? item.overview.substring(0, 180) + "..." : "Sem sinopse.";
    document.getElementById('hero-play-btn').onclick = () => exibirPretelaDetalhes(item.id, item.media_type || 'movie');
}

function renderizarMinhaLista() {
    const container = document.getElementById('row-watchlist');
    const section = document.getElementById('row-watchlist-section');
    if(!container || !section) return;

    const itens = Object.values(biblioteca.watchlist).reverse();
    if(itens.length === 0) { section.style.display = 'none'; return; }
    
    section.style.display = 'block'; container.innerHTML = '';
    itens.forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card'; card.onclick = () => exibirPretelaDetalhes(item.id, item.custom_type);
        card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}"><div class="watched-indicator">✓</div>`;
        container.appendChild(card);
    });
}

// ==========================================
// SISTEMA DE PESQUISA INTELIGENTE
// ==========================================
function mostrarHome() {
    document.getElementById('homepage-content').style.display = 'block';
    document.getElementById('search-results-section').style.display = 'none';
    document.querySelectorAll('.nav-menu a, .mobile-bottom-nav a').forEach(a => a.classList.remove('active', 'active-nav'));
}

function mostrarPesquisaTab() {
    document.getElementById('homepage-content').style.display = 'none';
    document.getElementById('search-results-section').style.display = 'block';
    const inputMain = document.getElementById('main-search-input');
    if(inputMain) inputMain.focus();
}

function alterarFiltroBusca(filtro, elemento) {
    filtroBuscaAtual = filtro;
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    if(elemento) elemento.classList.add('active');
    executarBuscaGlobal(ultimoTermoBusca);
}

function limparBuscaPagina() {
    document.getElementById('main-search-input').value = '';
    const pcInput = document.getElementById('search-input-pc'); if(pcInput) pcInput.value = '';
    ultimoTermoBusca = ''; document.getElementById('search-grid').innerHTML = '';
}

const inputsBusca = ['#search-input-pc', '#main-search-input'];
inputsBusca.forEach(seletor => {
    const el = document.querySelector(seletor);
    if(!el) return;
    el.addEventListener('input', (e) => {
        const termo = e.target.value;
        inputsBusca.forEach(s => { const inputOut = document.querySelector(s); if(inputOut && inputOut !== e.target) inputOut.value = termo; });
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { mostrarPesquisaTab(); executarBuscaGlobal(termo); }, 400);
    });
});

async function executarBuscaGlobal(termo) {
    ultimoTermoBusca = termo;
    const grid = document.getElementById('search-grid');
    if(!termo.trim()) { grid.innerHTML = ''; return; }

    grid.innerHTML = '<p style="color: var(--primary-neon); padding: 20px; width: 100%; text-align: center;">Pesquisando no catálogo...</p>';

    try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(termo)}`);
        const data = await res.json();
        
        let filtrados = data.results.filter(i => i.media_type !== 'person' && i.poster_path);
        
        if (filtroBuscaAtual !== 'all') {
            filtrados = filtrados.filter(item => {
                const type = item.media_type || (item.name ? 'tv' : 'movie');
                const genres = item.genre_ids || [];
                const lang = item.original_language || '';
                
                if (filtroBuscaAtual === 'movie') return type === 'movie';
                if (filtroBuscaAtual === 'tv') return type === 'tv' && !genres.includes(16);
                if (filtroBuscaAtual === 'anime') return genres.includes(16) && lang === 'ja';
                if (filtroBuscaAtual === 'cartoon') return genres.includes(16) && lang !== 'ja';
                return true;
            });
        }
        
        grid.innerHTML = '';
        if(filtrados.length === 0) { grid.innerHTML = '<p style="color: #666; width: 100%; text-align: center;">Nenhum título compatível encontrado.</p>'; return; }

        filtrados.forEach(item => {
            item.custom_type = item.media_type || (item.name ? 'tv' : 'movie');
            const card = document.createElement('div');
            card.className = 'movie-card'; card.style.width = '100%';
            card.onclick = () => exibirPretelaDetalhes(item.id, item.custom_type);
            card.innerHTML = `<img src="https://image.tmdb.org/t/p/w300${item.poster_path}">`;
            grid.appendChild(card);
        });
    } catch(err) { grid.innerHTML = '<p style="color: #666;">Erro ao processar busca.</p>'; }
}

// ==========================================
// MODAL DE DETALHES (PREVIEW NETFLIX)
// ==========================================
async function exibirPretelaDetalhes(id, tipo) {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${tipo}/${id}?api_key=${TMDB_KEY}&language=pt-BR`);
        itemSelecionado = await res.json();
        itemSelecionado.custom_type = tipo;
        
        const titulo = itemSelecionado.title || itemSelecionado.name;
        const sinopse = itemSelecionado.overview || "Nenhuma sinopse disponível.";
        const nota = itemSelecionado.vote_average ? Math.floor(itemSelecionado.vote_average * 10) : 85;
        const dataLancamento = itemSelecionado.release_date || itemSelecionado.first_air_date || "";
        const ano = dataLancamento ? dataLancamento.split('-')[0] : "----";
        const banner = itemSelecionado.backdrop_path ? `https://image.tmdb.org/t/p/w780${itemSelecionado.backdrop_path}` : '';

        document.getElementById('modal-media-title').innerText = titulo;
        document.getElementById('modal-media-overview').innerText = sinopse;
        document.getElementById('modal-match').innerText = `${nota}% Relevante`;
        document.getElementById('modal-media-year').innerText = ano;
        document.getElementById('modal-netflix-banner').style.backgroundImage = banner ? `url('${banner}')` : 'none';

        const btnList = document.getElementById('modal-watchlist-btn');
        if(biblioteca.watchlist[id]) {
            btnList.innerText = '✓ Na Minha Lista'; btnList.style.borderColor = '#00ff88'; btnList.style.color = '#00ff88';
        } else {
            btnList.innerText = '+ Minha Lista'; btnList.style.borderColor = 'rgba(255,255,255,0.4)'; btnList.style.color = 'white';
        }

        const dadosReview = biblioteca.reviews[id] || { rating: 0, text: "" };
        definirEstrelas(dadosReview.rating, false);
        document.getElementById('review-text').value = dadosReview.text;

        document.getElementById('modal-play-btn').onclick = () => { fecharModalDetalhes(); abrirPlayer(id, tipo); };

        document.getElementById('detailsModal').style.display = 'flex';
        alternarScrollBody(true);
    } catch (error) { console.error(error); }
}

function fecharModalDetalhes() { document.getElementById('detailsModal').style.display = 'none'; alternarScrollBody(false); }

function toggleWatchlist() {
    if(!itemSelecionado) return;
    const id = itemSelecionado.id;
    if(biblioteca.watchlist[id]) delete biblioteca.watchlist[id];
    else biblioteca.watchlist[id] = itemSelecionado;
    salvarDados(); exibirPretelaDetalhes(id, itemSelecionado.custom_type); 
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
    if (!itemSelecionado) return;
    const nota = estrelasAtivas;
    const textoComentario = document.getElementById('review-text').value.trim();
    if (nota === 0) { alert("Selecione pelo menos 1 estrela."); return; }
    biblioteca.reviews[itemSelecionado.id] = { rating: nota, text: textoComentario };
    salvarDados(); 
    alert("Avaliação salva com sucesso!");
}

// ==========================================
// REPRODUTOR DE VÍDEO CORRIGIDO
// ==========================================
function abrirPlayer(id, tipo) {
    const epBox = document.getElementById('episodes-selectors-box');
    if (tipo === 'tv') { epBox.style.display = 'flex'; modoPlayerAtual = 'series'; } 
    else { epBox.style.display = 'none'; modoPlayerAtual = 'geral'; }

    document.getElementById('playerModal').style.display = 'flex';
    alternarScrollBody(true); atualizarIframePlayer();
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
        player.src = `https://mgeb.top/embed/${id}/${season}/${episode}?player=vidstack#color:${corDestaque}`; 
    }
}