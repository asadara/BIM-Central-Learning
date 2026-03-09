//Mengatur email dari web ke email BIM NKE
document.getElementById("sendEmail").addEventListener("click", async function () {
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const subject = document.getElementById("subject").value.trim();
        const message = document.getElementById("message").value.trim();

        if (!name || !email || !subject || !message) {
            alert("Harap isi semua kolom!");
            return;
        }

        try {
            const response = await fetch("${window.location.origin}/send-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, subject, message })
            });

            const result = await response.json();
            if (result.success) {
                alert("✅ Email berhasil dikirim!");
                document.querySelector("form").reset(); // Reset form setelah sukses
            } else {
                alert("❌ Gagal mengirim email. Silakan coba lagi.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("❌ Terjadi kesalahan, email tidak terkirim.");
        }
    });