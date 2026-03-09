//aPI FrontEnd
const rootPath = 'G:/BIM CENTRAL LEARNING/';
const allowedExtensions = ['mp4', 'avi', 'mov', 'mkv'];

let allVideos = []; // Menyimpan daftar semua video


async function fetchVideoFiles() {
    try {
        const response = await fetch('/api/videos'); // Pastikan endpoint sesuai dengan backend
        const files = await response.json();
        displayFiles(files);
    } catch (error) {
        console.error('Gagal mengambil daftar video:', error);
    }
}

function fetchVideos() {
    fetch('/api/videos') // Pastikan endpoint benar
        .then(response => {
            if (!response.ok) {
                throw new Error("Gagal mengambil data video");
            }
            return response.json();
        })
        .then(videos => {
            allVideos = videos;  // Simpan semua video untuk pencarian
            console.log("Video berhasil di-load:", allVideos);
            displayFiles(videos);
        })
        .catch(error => console.error("Error:", error));
}


function displayFiles(videos) {
    console.log("📜 Data dari backend:", videos); // Debugging

    const fileList = document.getElementById("file-list");
    fileList.innerHTML = ""; // Bersihkan daftar sebelum ditambahkan

    // **Urutkan file berdasarkan nama (A-Z)**
    videos.sort((a, b) => a.name.localeCompare(b.name));

    const row = document.createElement("div");
    row.classList.add("row", "g-3"); // Tambahkan jarak antar card

    videos.forEach(video => {
        const col = document.createElement("div");
        col.classList.add("col-md-2", "col-sm-4", "col-6"); // 5 card per baris di desktop, responsif untuk tablet & HP

        const card = document.createElement("div");
        card.classList.add("card", "video-card", "h-100", "bg-white"); // Pastikan background putih

        card.innerHTML = `
                    <div class="card-body text-center">
                        <img src="/img/icons/video-icon2.png" class="video-icon mb-2" alt="Video Icon">
                        <h6 class="video-title mt-2">${video.name}</h6>
                        <p class="text-muted small">Size: ${video.size}</p> <!-- Ukuran File -->
                    </div>
                `;

        // Event listener untuk klik video
        card.addEventListener("click", function () {
            document.getElementById("video-preview").src = video.url;
            document.getElementById("video-preview").style.display = "block";
        });

        col.appendChild(card);
        row.appendChild(col);
    });

    fileList.appendChild(row); // Masukkan row ke dalam file-list
}

const TutorialPage = {
    searchFiles: function () {
        console.log("🔍 TutorialPage.searchFiles() dipanggil!");
        let input = document.getElementById("searchInput").value.toLowerCase();
        let cards = document.querySelectorAll(".video-card");

        cards.forEach(card => {
            let title = card.querySelector(".video-title").textContent.toLowerCase();
            if (title.includes(input)) {
                card.parentElement.style.display = "block";
            } else {
                card.parentElement.style.display = "none";
            }
        });
    }
};
document.addEventListener('DOMContentLoaded', fetchVideoFiles);