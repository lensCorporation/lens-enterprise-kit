<script>
    export let error;
  </script>
  
  <div class="error-container">
    <h1>Something went wrong!</h1>
    <p>{error?.message || "An unexpected error occurred."}</p>
    <button on:click={() => window.location.reload()}>Reload Page</button>
  </div>
  
  <style>
    .error-container {
      text-align: center;
      padding: 20px;
      background: #ffdddd;
      color: #d32f2f;
    }
  </style>
    