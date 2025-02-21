export function useApi(route: string, options: any = {}, ssr: boolean = true) {
    const apiUrl = import.meta.env.VITE_API_GATEWAY_URL || '/api'; // Use API Gateway
    const url = `${apiUrl}/${route}`;

    const fetchData = async () => {
        if (ssr) {
            return await fetch(`/api/${route}`).then(res => res.json());
        } else {
            return await fetch(`/client-api/${route}`).then(res => res.json());
        }
    };
    return fetchData;
}


//Usage

// <script>
//   import { onMount } from 'svelte';
//   import { useApi } from '$lib/hooks/useApi';

//   let data = null;
//   let error = null;
//   const fetchData = useApi('dashboard-data');

//   onMount(async () => {
//     try {
//       data = await fetchData();
//     } catch (err) {
//       error = err.message;
//     }
//   });
// </script>

// {#if error}
//   <p>Error: {error}</p>
// {:else if data}
//   <p>Data Loaded: {JSON.stringify(data)}</p>
// {:else}
//   <p>Loading...</p>
// {/if}
