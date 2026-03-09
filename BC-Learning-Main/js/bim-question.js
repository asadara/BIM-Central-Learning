const API_URL = `/api/questions`;

document.addEventListener("DOMContentLoaded", function () {
  loadQuestions();

  const submitBtn = document.getElementById("submitQuestion");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitQuestion);
  }

  const popup = document.getElementById("popupForm");
  const dragBar = document.getElementById("dragBar");
  if (popup && dragBar) {
    makeDraggable(popup, dragBar);
  }
});

function loadQuestions() {
  fetch(API_URL)
    .then(response => response.json())
    .then(data => {
      const container = document.getElementById("containertanya");
      if (!container) return;
      container.innerHTML = "";

      data.forEach(item => {
        const questionDiv = document.createElement("div");
        questionDiv.classList.add("question-card");

        const waktuTanya = item.tanggalTanya
          ? `<small style="color: gray;">🕒 ${item.tanggalTanya}</small>` : "";

        const waktuJawab = item.tanggalJawaban
          ? `<br><small style="color: gray;">🕓 ${item.tanggalJawaban} oleh ${item.dijawabOleh || "NN"}</small>` : "";

        questionDiv.innerHTML = `
          <div class="question-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${item.nama}</strong><span style="margin-left: 8px;">| ${item.proyek}</span>
            </div>
            ${waktuTanya}
          </div>
          <p style="color: blue;"><b>Pertanyaan:</b> ${item.pertanyaan}</p>
          <p style="color: darkred;"><b>Jawaban:</b> ${item.jawaban || "Belum dijawab"} ${waktuJawab}</p>
          <div class="jawaban-form">
            <input type="text" id="jawaban-${item.id}" placeholder="Tulis jawaban..." 
              value="${item.jawaban && item.jawaban !== 'Belum dijawab' ? item.jawaban : ''}">
            <button onclick="updateAnswer(${item.id})">💬 Jawab</button>
            <button onclick="deleteQuestion(${item.id})" style="margin-left: 8px;">🗑 Hapus</button>
          </div>
        `;
        container.appendChild(questionDiv);
      });
    })
    .catch(error => console.error("❌ Gagal memuat pertanyaan:", error));
}

function updateAnswer(id) {
  if (!localStorage.getItem("token")) {
    alert("🚫 Anda harus login untuk menjawab pertanyaan.");
    return;
  }

  const jawabanInput = document.getElementById(`jawaban-${id}`);
  const jawaban = jawabanInput.value.trim();

  if (!jawaban) {
    alert("⚠️ Tolong masukkan jawaban terlebih dahulu.");
    return;
  }

  const tanggalJawaban = new Date().toISOString().slice(0, 16).replace("T", " ");
  const dijawabOleh = localStorage.getItem("username") || "NN";

  // Disablejawaban button during submission to prevent double submission
  const answerBtn = document.querySelector(`button[onclick="updateAnswer(${id})"]`);
  if (answerBtn) {
    answerBtn.disabled = true;
    answerBtn.textContent = "⏳ Menyimpan...";
  }

  fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jawaban, tanggalJawaban, dijawabOleh })
  })
    .then(res => res.json())
    .then(data => {
      alert("✅ Jawaban berhasil diperbarui!");
      jawabanInput.value = ""; // Bersihkan input setelah berhasil
      jawabanInput.style.borderColor = "#28a745"; // Green border untuk sukses
      setTimeout(() => loadQuestions(), 500); // Refresh daftar dengan delay kecil
    })
    .catch(error => {
      console.error("❌ Gagal memperbarui jawaban:", error);
      alert("❌ Gagal menyimpan jawaban!");
      // Highlight input field on error
      jawabanInput.style.borderColor = "#dc3545"; // Red border untuk error
    })
    .finally(() => {
      // Re-enable button regardless of success/error
      if (answerBtn) {
        answerBtn.disabled = false;
        answerBtn.textContent = "💬 Jawab";
      }
    });
}


function submitQuestion() {
  const nama = document.getElementById("nama").value.trim();
  const bagian = document.getElementById("bagian").value.trim();
  const proyek = document.getElementById("proyek").value.trim();
  const email = document.getElementById("email").value.trim();
  const pertanyaan = document.getElementById("pertanyaan").value.trim();

  const tanggalTanya = new Date().toISOString().slice(0, 16).replace("T", " ");

  const data = {
    nama,
    bagian,
    proyek,
    email,
    pertanyaan,
    tanggalTanya,
    jawaban: "",
    tanggalJawaban: "",
    dijawabOleh: ""
  };

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then((result) => {
      alert("✅ Pertanyaan berhasil dikirim!");
      closeForm();
      loadQuestions();
    })
    .catch((err) => {
      console.error("❌ Gagal mengirim pertanyaan:", err);
      alert("❌ Gagal mengirim pertanyaan.");
    });
}


function deleteQuestion(id) {
  if (!confirm("Yakin ingin menghapus pertanyaan ini?")) return;

  fetch(`${API_URL}/${id}`, { method: "DELETE" })
    .then(res => {
      if (!res.ok) throw new Error("Gagal menghapus pertanyaan");
      return res.json();
    })
    .then(result => {
      alert("✅ " + result.message);
      loadQuestions();
    })
    .catch(err => {
      console.error("❌ Gagal menghapus:", err);
      alert("❌ Gagal menghapus pertanyaan.");
    });
}

function openForm() {
  document.getElementById("popupForm").style.display = "block";
}

function closeForm() {
  const form = document.getElementById("popupForm");
  if (form) form.style.display = "none";
}

function makeDraggable(popup, dragBar) {
  let offsetX = 0, offsetY = 0, mouseX = 0, mouseY = 0;

  dragBar.onmousedown = function (e) {
    e.preventDefault();
    mouseX = e.clientX;
    mouseY = e.clientY;

    document.onmouseup = stopDrag;
    document.onmousemove = dragPopup;
  };

  function dragPopup(e) {
    e.preventDefault();
    offsetX = e.clientX - mouseX;
    offsetY = e.clientY - mouseY;

    popup.style.top = popup.offsetTop + offsetY + "px";
    popup.style.left = popup.offsetLeft + offsetX + "px";

    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  function stopDrag() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}
