const TMDB_KEY = '17c56e3825d7fbae6581866083d0d778';
let itemSelecionado = null;
let estrelasAtivas = 0;
let timerBusca; 

// Base de dados local
let biblioteca = JSON.parse(localStorage.getItem('cineNetflixLibV2')) || { watchlist: {}, reviews: {} };

function salvarDados() {
    localStorage.setItem('cineNetflixLibV2', JSON.stringify(biblioteca));
    renderizarMinhaLista();
}

function alternarScrollBody(travar) {
    if (travar) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
}

// Fecha modal clicando fora do quadro
window.addEventListener('click', function(event) {
    const detailsModal = document.getElementById('detailsModal');
    if (event.target === detailsModal) fecharModal();
});

window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 30) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
});

// ==========================================
// RENDERIZAÇÃO DAS CATEGORIAS (MUITAS IMAGENS)
// ==========================================
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

// INJETA MULTIPLAS PÁGINAS DA API PARA MAIOR VARIEDADE
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
                card.onclick = (e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    abrirModal(item); 
                };
                
                const estaNaLista = biblioteca.watchlist[item.id] ? `<div class="watched-bar"></div>` : "";
                const titulo = item.title || item.name;
                
                card.innerHTML = `
                    <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${titulo}" loading="lazy">
                    ${estaNaLista}
                `;
                container.appendChild(card);
            });
        } catch (err) { console.error(err); }
    }
}

async function carregarDashboard() {
    const wrapper = document.getElementById('rows-wrapper-layout');
    wrapper.innerHTML = '';

    // As Categorias baseadas no Nav
    injetarEstruturaRow('row-movies', 'Filmes em Alta e Ação');
    injetarEstruturaRow('row-series', 'Séries de TV Mais Assistidas');
    injetarEstruturaRow('row-animes', 'Animes e Cultura Pop Japonesa');
    injetarEstruturaRow('row-cartoons', 'Desenhos Animados e Clássicos');
    injetarEstruturaRow('row-watchlist', 'Minha Lista');

    try {
        const resTrending = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_KEY}&language=pt-BR`);
        const dataTrending = await resTrending.json();
        if(dataTrending.results.length > 0) configurarHero(dataTrending.results[0]);
    } catch(e) { console.error(e); }

    // Multi-fetch para encher os carrosséis de conteúdo
    montarPostersMultiPage([
        `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`,
        `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=pt-BR&with_genres=28&page=1`,
        `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&language=pt-BR&with_genres=35&page=1`
    ], 'row-movies', 'movie');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=pt-BR&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=18&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=10759&page=1`
    ], 'row-series', 'tv');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=2`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=3`
    ], 'row-animes', 'tv');

    montarPostersMultiPage([
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=en&sort_by=popularity.desc&page=1`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=en&sort_by=popularity.desc&page=2`,
        `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_KEY}&language=pt-BR&with_genres=16&with_original_language=en&sort_by=popularity.desc&page=3`
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
    
    document.getElementById('hero-play-btn').onclick = () => { itemSelecionado = item; abrirPlayerAtual(); };
    document.getElementById('hero-info-btn').onclick = () => abrirModal(item);
}

function renderizarMinhaLista() {
    const container = document.getElementById('row-watchlist');
    const section = document.getElementById('row-watchlist-section');
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
        card.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w300${item.poster_path}" alt="${titulo}">
            <div class="watched-bar"></div>
        `;
        container.appendChild(card);
    });
}

// ==========================================
// PESQUISA RÁPIDA DEBOUNCE
// ==========================================
document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(timerBusca);
    timerBusca = setTimeout(async () => {
        const termo = e.target.value;
        const home = document.getElementById('homepage-content');
        const searchSection = document.getElementById('search-results-section');
        const grid = document.getElementById('search-grid');

        if(!termo.trim()) {
            limparBusca();
            return;
        }

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
// MODAL CLÁSSICO E AVALIAÇÕES (NOTAS)
// ==========================================
function abrirModal(item) {
    itemSelecionado = item;
    const id = item.id;

    document.getElementById('modal-hero-bg').style.backgroundImage = `url('https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}')`;
    document.getElementById('modal-title').innerText = item.title || item.name;
    document.getElementById('modal-desc').innerText = item.overview || "Esta obra ainda não possui uma sinopse disponível em português.";
    
    const baseMatch = item.vote_average ? Math.floor(item.vote_average * 10) : 85;
    document.getElementById('modal-match').innerText = `${baseMatch}% de correspondência`;
    
    const dataLancamento = item.release_date || item.first_air_date || '2026';
    document.getElementById('modal-year').innerText = dataLancamento.substring(0,4);

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
    alert("Anotação e avaliação salvas com sucesso!");
}

// ==========================================
// PLAYER DE VÍDEO (API: MYEMBED.BIZ)
// ==========================================
function abrirPlayerAtual() {
    if(!itemSelecionado) return;
    
    const tipo = itemSelecionado.custom_type; 
    const modal = document.getElementById('playerModal');
    const epBox = document.getElementById('episodes-selectors-box');

    // Se for Série ou Anime (TV), mostrar inputs de Temporada/Episódio
    if (tipo === 'tv') {
        epBox.style.display = 'flex';
    } else {
        epBox.style.display = 'none';
    }

    fecharModal(); 
    atualizarIframePlayer(); 
    
    modal.style.display = 'flex';
    alternarScrollBody(true);
}

// Atualiza o link do Iframe baseado nas regras dadas
function atualizarIframePlayer() {
    if (!itemSelecionado) return;
    
    const id = itemSelecionado.id;
    const tipo = itemSelecionado.custom_type;
    const player = document.getElementById('videoPlayer');
    
    let urlDoVideo = "";

    if (tipo === 'movie') {
        urlDoVideo = `https://myembed.biz/filme/${id}`; 
    } else {
        // Se for série, capta os valores dos inputs (por padrão 1 e 1)
        const season = document.getElementById('player-season-input').value || 1;
        const episode = document.getElementById('player-episode-input').value || 1;
        urlDoVideo = `https://myembed.biz/serie/${id}/${season}/${episode}`; 
    }

    player.src = urlDoVideo;
}

function fecharPlayer() {
    document.getElementById('playerModal').style.display = 'none';
    document.getElementById('videoPlayer').src = "";
    alternarScrollBody(false);
}

// Inicia tudo
carregarDashboard();