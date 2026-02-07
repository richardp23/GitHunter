async function sendToBackend(event) { 
    event.preventDefault();
    const username = document.getElementById("username").value; 
    // Call backend 
    const res = await fetch(`http://localhost:5000/api/user/${username}`); 
    const data = await res.json(); 

    console.log(data);
}
