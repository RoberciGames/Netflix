// ==========================================
// CONFIGURAÇÃO DA API 
// ==========================================
const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778'; 
const IMG_BASE = 'https://image.tmdb.org/t/p/original';
const IMG_THUMB = 'https://image.tmdb.org/t/p/w500';

let abaAtual = 'inicio';
let isLoginMode = true;
let currentUser = null;
let currentItem = null; 
let minhaListaDB = JSON.parse(localStorage.getItem('cineNetLista')) || {};
let servidorSelecionado = 'smashy'; 

// ==========================================
// INICIALIZAÇÃO E FECHAMENTO SEGURO
// ==========================================
window.onload = () => {
    const savedUser = localStorage.getItem('cineNetCurrentUser');
    if (savedUser) {
        currentUser = savedUser;
        iniciarAplicativo();
    }
    
    const wrapper = document.querySelector('.main-wrapper');
    if(wrapper) {
        wrapper.addEventListener('scroll', () => {
            const header = document.getElementById('navbar');
            if (wrapper.scrollTop > 10) header.classList.add('scrolled');
            else header.classList.remove('scrolled');
        });
    }
};

// Permite fechar os modais ao clicar no fundo escuro
window.addEventListener('click', function(event) {
    const detailsModal = document.getElementById('detailsModal');
    const profileModal = document.getElementById('profileModal');

    if (event.target === detailsModal) fecharModal();
    if (event.target === profileModal) fecharPerfil();
});

function alternarScrollBody(travar) {
    if (travar) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
}

// ==========================================
// SISTEMA DE AUTENTICAÇÃO
// ==========================================
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Entrar' : 'Criar Conta';
    document.getElementById('auth-btn').innerText = isLoginMode ? 'Entrar' : 'Registar';
    document.getElementById('auth-link').innerText = isLoginMode ? 'Subscreva agora.' : 'Entrar agora.';
    document.getElementById('auth-error').style.display = 'none';
}

function handleAuth(event) {
    event.preventDefault();
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const errorBox = document.getElementById('auth-error');
    
    let usersDB = JSON.parse(localStorage.getItem('cineNetUsersDB')) || {};
    
    if (isLoginMode) {
        if (usersDB[user] && usersDB[user].pass === pass) {
            currentUser = user;
            localStorage.setItem('cineNetCurrentUser', user);
            iniciarAplicativo();
        } else {
            errorBox.innerText = "Palavra-passe incorreta ou utilizador não encontrado.";
            errorBox.style.display = 'block';
        }
    } else {
        if (usersDB[user]) {
            errorBox.innerText = "Esta conta já existe. Tente fazer login.";
            errorBox.style.display = 'block';
        } else {
            usersDB[user] = { pass: pass, name: 'Utilizador', avatar: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png' };
            localStorage.setItem('cineNetUsersDB', JSON.stringify(usersDB));
            currentUser = user;
            localStorage.setItem('cineNetCurrentUser', user);
            iniciarAplicativo();
        }
    }
}

function fazerLogout() {
    localStorage.removeItem('cineNetCurrentUser');
    currentUser = null;
    document.getElementById('main-app').style.display = 'none';
    fecharPerfil(); // Garante que tira a classe .show e limpa o scroll
    document.getElementById('auth-screen').style.display = 'flex';
}

function iniciarAplicativo() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    
    let usersDB = JSON.parse(localStorage.getItem('cineNetUsersDB')) || {};
    if(usersDB[currentUser]) document.getElementById('nav-avatar').src = usersDB[currentUser].avatar;
    
    mudarAba('inicio');
}

// ==========================================
// NAVEGAÇÃO
// ==========================================
function mudarAba(aba) {
    abaAtual = aba;
    fecharCatalogoMobile();
    fecharPerfil();
    fecharModal();
    
    document.getElementById('search-input').value = '';
    const mobileSearch = document.getElementById('search-input-mobile');
    if(mobileSearch) mobileSearch.value = '';
    
    document.getElementById('search-results-section').style.display = 'none';
    
    document.querySelectorAll('.menu-items a').forEach(l => l.classList.remove('active'));
    const sideNav = document.getElementById('side-nav-' + aba);
    if(sideNav) sideNav.classList.add('active');
    
    document.querySelectorAll('.top-nav-links a').forEach(l => l.classList.remove('active'));
    const topNav = document.getElementById('top-nav-' + aba);
    if(topNav) topNav.classList.add('active');

    const wrapper = document.querySelector('.main-wrapper');
    if(wrapper) wrapper.scrollTo({ top: 0, behavior: 'smooth' });
    
    carregarDashboard(aba);
}

function ativarMenuMobile(elemento) {
    document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(item => item.classList.remove('active-mobile-nav'));
    elemento.classList.add('active-mobile-nav');
}

function abrirCatalogoMobile() { 
    const cat = document.getElementById('mobile-catalog');
    cat.style.display = 'flex'; 
    setTimeout(() => cat.classList.add('show'), 10);
    alternarScrollBody(true); 
}
function fecharCatalogoMobile() { 
    const cat = document.getElementById('mobile-catalog');
    if(cat) {
        cat.classList.remove('show');
        setTimeout(() => { cat.style.display = 'none'; alternarScrollBody(false); }, 300);
    }
}
function abrirPerfilMobile() { fecharCatalogoMobile(); abrirPerfil(); }

// ==========================================
// CARREGAMENTO DA DASHBOARD (GRID DESIGN)
// ==========================================
async function carregarDashboard(aba) {
    const rowsWrapper = document.getElementById('rows-wrapper-layout');
    rowsWrapper.innerHTML = '';
    
    if (aba === 'minhalista') {
        document.getElementById('homepage-content').style.display = 'none';
        document.getElementById('minha-lista-section').style.display = 'block';
        renderizarPaginaMinhaLista();
        return;
    }

    document.getElementById('homepage-content').style.display = 'grid'; 
    document.getElementById('minha-lista-section').style.display = 'none';

    // --- LÓGICA DE DESTAQUE DINÂMICO (Hero Banner) ---
    const destaquesEspeciais = [
        { id: 34524, type: 'tv' },     // Teen Wolf Série
        { id: 894205, type: 'movie' }  // Teen Wolf Filme
    ];

    try {
        let itemDestaque = null;
        // 50% de probabilidade de mostrar Teen Wolf, 50% de mostrar um popular aleatório
        const mostrarEspecial = Math.random() > 0.5;

        if (mostrarEspecial) {
            const randomItem = destaquesEspeciais[Math.floor(Math.random() * destaquesEspeciais.length)];
            const res = await fetch(`https://api.themoviedb.org/3/${randomItem.type}/${randomItem.id}?api_key=${TMDB_KEY}&language=pt-BR`);
            itemDestaque = await res.json();
            itemDestaque.media_type = randomItem.type; 
        } else {
            const resTrending = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`);
            const dataTrending = await resTrending.json();
            if(dataTrending.results.length > 0) {
                const randomIndex = Math.floor(Math.random() * Math.min(5, dataTrending.results.length));
                itemDestaque = dataTrending.results[randomIndex];
            }
        }
        if(itemDestaque) configurarHeroDashboard(itemDestaque);

    } catch(e) { console.error("Erro no Hero", e); }

    atualizarContinueAssistindoWidget();

    if (aba === 'inicio') {
        injetarEstruturaRow('row-especial', 'Seleção Especial');
        injetarEstruturaRow('row-movies', 'Populares na CineNet');
        injetarEstruturaRow('row-series', 'Séries em Alta');
        
        carregarDestaquesFixos('row-especial'); 
        montarPosters(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-BR`, 'row-movies', 'movie');
        montarPosters(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-BR`, 'row-series', 'tv');
    } else if (aba === 'filmes') {
        injetarEstruturaRow('row-movies', 'Filmes em Alta');
        montarPosters(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-BR`, 'row-movies', 'movie');
    } else if (aba === 'series') {
        injetarEstruturaRow('row-especial', 'Destaque: Teen Wolf');
        injetarEstruturaRow('row-series', 'Séries Mais Assistidas');
        
        carregarDestaquesFixos('row-especial');
        montarPosters(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-BR`, 'row-series', 'tv');
    }
}

function configurarHeroDashboard(item) {
    currentItem = item;
    currentItem.media_type = item.media_type || (item.title ? 'movie' : 'tv');

    const posterUrl = item.poster_path ? IMG_THUMB + item.poster_path : '';
    document.getElementById('hero-poster').src = posterUrl;
    
    const title = item.title || item.name;
    document.getElementById('hero-title').innerText = title;
    document.getElementById('player-title-overlay').innerText = title;
    document.getElementById('hero-synopsis').innerText = item.overview || 'Sinopse não disponível.';
    
    let year = (item.release_date || item.first_air_date || 'N/A').substring(0,4);
    let typeName = currentItem.media_type === 'tv' ? 'Série' : 'Filme';
    document.getElementById('hero-meta').innerText = `${year} - ${typeName}`;

    const bgUrl = item.backdrop_path ? IMG_BASE + item.backdrop_path : '';
    document.getElementById('hero-bg').style.backgroundImage = `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.95)), url('${bgUrl}')`;

    document.getElementById('hero-play-btn').onclick = abrirPlayerAtual;
    document.getElementById('hero-info-btn').onclick = () => abrirModal(item.id, currentItem.media_type);
}

// ==========================================
// WIDGET CONTINUE A ASSISTIR E DESTAQUES FIXOS
// ==========================================
function atualizarContinueAssistindoWidget() {
    const container = document.getElementById('continue-list-dynamic');
    if(!container) return;
    container.innerHTML = '';
    
    const lista = minhaListaDB[currentUser] || {};
    const ids = Object.keys(lista).reverse(); 
    
    if(ids.length === 0) {
        container.innerHTML = '<p style="color:#666; font-size: 13px;">Adicione títulos à sua lista.</p>';
        return;
    }
    
    const limitedIds = ids.slice(0, 2); 
    limitedIds.forEach(id => {
        const item = lista[id];
        container.innerHTML += `
            <div class="continue-card" onclick="abrirModal(${item.id}, '${item.type}')">
                <div class="continue-thumb-box">
                    <img src="${IMG_THUMB + item.poster}" alt="Thumb">
                    <div class="continue-progress" style="width: ${Math.floor(Math.random() * 60 + 20)}%;"></div>
                </div>
                <div class="continue-info">
                    <h4>${item.title || 'Título'}</h4>
                </div>
            </div>
        `;
    });
}

async function carregarDestaquesFixos(containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;
    
    const itensFixos = [
        { id: 34524, type: 'tv' },      
        { id: 894205, type: 'movie' }   
    ];
    
    try {
        for (let itemFixo of itensFixos) {
            const res = await fetch(`https://api.themoviedb.org/3/${itemFixo.type}/${itemFixo.id}?api_key=${TMDB_KEY}&language=pt-BR`);
            const item = await res.json();
            
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.onclick = () => abrirModal(item.id, itemFixo.type);
            
            let minhalistaStr = (minhaListaDB[currentUser] && minhaListaDB[currentUser][item.id]) ? `<div class="watched-bar"></div>` : "";
            const titulo = item.title || item.name; 
            
            card.innerHTML = `<img src="${IMG_THUMB + item.poster_path}" alt="${titulo}" title="${titulo}">${minhalistaStr}`;
            container.appendChild(card);
        }
    } catch(e) { console.error(e); }
}

// ==========================================
// CARROSSEIS (ROWS)
// ==========================================
function injetarEstruturaRow(id, title) {
    const wrapper = document.getElementById('rows-wrapper-layout');
    wrapper.innerHTML += `
        <div class="movie-row">
            <h2 class="row-title">${title}</h2>
            <div class="row-posters" id="${id}"></div>
        </div>
    `;
}

async function montarPosters(url, containerId, defaultType) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        const container = document.getElementById(containerId);
        if(!container) return;
        
        data.results.forEach(item => {
            if (!item.poster_path) return;
            const type = item.media_type || defaultType;
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.onclick = () => abrirModal(item.id, type);
            
            let minhalistaStr = (minhaListaDB[currentUser] && minhaListaDB[currentUser][item.id]) ? `<div class="watched-bar"></div>` : "";
            card.innerHTML = `<img src="${IMG_THUMB + item.poster_path}" loading="lazy">${minhalistaStr}`;
            container.appendChild(card);
        });
    } catch (e) {}
}

// ==========================================
// PESQUISA E A MINHA LISTA SECTION
// ==========================================
async function realizarBusca(query) {
    if (query.length > 2) {
        document.getElementById('homepage-content').style.display = 'none';
        document.getElementById('minha-lista-section').style.display = 'none';
        fecharCatalogoMobile();
        document.getElementById('search-results-section').style.display = 'block';
        
        const grid = document.getElementById('search-grid');
        grid.innerHTML = '';
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${query}`);
            const data = await res.json();
            
            data.results.forEach(item => {
                if (!item.poster_path) return;
                const type = item.media_type;
                if(type !== 'movie' && type !== 'tv') return;
                
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.onclick = () => abrirModal(item.id, type);
                card.innerHTML = `<img src="${IMG_THUMB + item.poster_path}">`;
                grid.appendChild(card);
            });
        } catch(e) {}
    } else if (query.length === 0) {
        mudarAba(abaAtual);
    }
}

function renderizarPaginaMinhaLista() {
    const grid = document.getElementById('row-watchlist');
    grid.innerHTML = '';
    const lista = minhaListaDB[currentUser] || {};
    const ids = Object.keys(lista).reverse();
    
    if(ids.length === 0) {
        grid.innerHTML = '<p style="color:#b3b3b3;">A sua lista está vazia.</p>';
        return;
    }
    
    ids.forEach(id => {
        const item = lista[id];
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.onclick = () => abrirModal(item.id, item.type);
        card.innerHTML = `<img src="${IMG_THUMB + item.poster}"><div class="watched-bar"></div>`;
        grid.appendChild(card);
    });
}

// ==========================================
// MODAL DE DETALHES POPUP COM ANIMAÇÃO SEGURA
// ==========================================
async function abrirModal(id, type) {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&language=pt-BR`);
        currentItem = await res.json();
        currentItem.media_type = type;

        document.getElementById('modal-title').innerText = currentItem.title || currentItem.name;
        document.getElementById('modal-desc').innerText = currentItem.overview || 'Sem descrição.';
        
        const year = (currentItem.release_date || currentItem.first_air_date || 'N/A').substring(0,4);
        let extras = (type === 'tv' && currentItem.number_of_seasons) ? ` ‧ ${currentItem.number_of_seasons} Temp` : "";
        document.getElementById('modal-year').innerText = year + extras;
        
        const bg = currentItem.backdrop_path ? IMG_BASE + currentItem.backdrop_path : '';
        document.getElementById('modal-hero-bg').style.backgroundImage = `url('${bg}')`;

        const btnWatch = document.getElementById('modal-watchlist-btn');
        if(btnWatch) {
            btnWatch.innerHTML = (minhaListaDB[currentUser] && minhaListaDB[currentUser][id]) ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-plus"></i>';
        }

        const modal = document.getElementById('detailsModal');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
        
        alternarScrollBody(true);
    } catch(e) {}
}

function fecharModal() {
    const modal = document.getElementById('detailsModal');
    if(!modal) return;
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        alternarScrollBody(false); // Libera o ecrã
        if(abaAtual === 'minhalista') carregarDashboard('minhalista');
        else if(abaAtual === 'inicio') atualizarContinueAssistindoWidget(); 
    }, 300);
}

function toggleWatchlist() {
    if(!currentItem) return;
    if(!minhaListaDB[currentUser]) minhaListaDB[currentUser] = {};
    
    const id = currentItem.id;
    const btnWatch = document.getElementById('modal-watchlist-btn');
    
    if (minhaListaDB[currentUser][id]) {
        delete minhaListaDB[currentUser][id];
        btnWatch.innerHTML = '<i class="fa-solid fa-plus"></i>';
    } else {
        minhaListaDB[currentUser][id] = { 
            id: id, type: currentItem.media_type, 
            title: currentItem.title || currentItem.name, 
            poster: currentItem.poster_path 
        };
        btnWatch.innerHTML = '<i class="fa-solid fa-check"></i>';
    }
    localStorage.setItem('cineNetLista', JSON.stringify(minhaListaDB));
}

// ==========================================
// SISTEMA DE PLAYER (MULTI-SERVIDORES)
// ==========================================
function selecionarServidorGlobal(btn, server) {
    document.querySelectorAll('.server-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    servidorSelecionado = server;
}

function abrirPlayerAtual() {
    if (!currentItem) return;

    const epBox = document.getElementById('episodes-selectors-box');
    if (currentItem.media_type === 'tv') epBox.style.display = 'flex';
    else epBox.style.display = 'none';

    atualizarIframePlayer();

    fecharModal(); // Fecha o de detalhes primeiro
    const playerModal = document.getElementById('playerModal');
    playerModal.style.display = 'block';
    alternarScrollBody(true);
}

function atualizarIframePlayer() {
    if (!currentItem) return;
    
    document.getElementById('playerLoader').style.display = 'flex';
    const id = currentItem.id;
    const season = document.getElementById('player-season-input').value || 1;
    const episode = document.getElementById('player-episode-input').value || 1;
    
    let finalUrl = "";
    if (currentItem.media_type === 'movie') {
        if (servidorSelecionado === 'smashy') finalUrl = `https://embed.smashystream.com/playere.php?tmdb=${id}`;
        else if (servidorSelecionado === 'super') finalUrl = `https://embed.superembed.com/api/movie?tmdb=${id}`;
        else finalUrl = `https://vidsrc.to/embed/movie/${id}`;
    } else {
        if (servidorSelecionado === 'smashy') finalUrl = `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${season}&episode=${episode}`;
        else if (servidorSelecionado === 'super') finalUrl = `https://embed.superembed.com/api/tv?tmdb=${id}&sea=${season}&epi=${episode}`;
        else finalUrl = `https://vidsrc.to/embed/tv/${id}/${season}/${episode}`;
    }
    
    document.getElementById('videoPlayer').src = finalUrl;
}

function esconderLoader() { document.getElementById('playerLoader').style.display = 'none'; }
function fecharPlayer() {
    document.getElementById('videoPlayer').src = "";
    document.getElementById('playerModal').style.display = 'none';
    alternarScrollBody(false);
}

// ==========================================
// PERFIL SEGURO COM ANIMAÇÃO
// ==========================================
let tempAvatar = "";
function abrirPerfil() {
    let usersDB = JSON.parse(localStorage.getItem('cineNetUsersDB')) || {};
    let data = usersDB[currentUser];
    document.getElementById('edit-profile-name').value = data.name || currentUser;
    tempAvatar = data.avatar;
    
    const modal = document.getElementById('profileModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
    alternarScrollBody(true);
}
function fecharPerfil() { 
    const modal = document.getElementById('profileModal');
    if(!modal) return;
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        alternarScrollBody(false);
    }, 300);
}
function escolherAvatar(el, src) {
    tempAvatar = src;
    document.querySelectorAll('.avatar-option').forEach(img => img.style.border = "none");
    el.style.border = "3px solid white";
}
function salvarPerfil() {
    let usersDB = JSON.parse(localStorage.getItem('cineNetUsersDB')) || {};
    usersDB[currentUser].name = document.getElementById('edit-profile-name').value;
    usersDB[currentUser].avatar = tempAvatar;
    localStorage.setItem('cineNetUsersDB', JSON.stringify(usersDB));
    document.getElementById('nav-avatar').src = tempAvatar;
    fecharPerfil();
}