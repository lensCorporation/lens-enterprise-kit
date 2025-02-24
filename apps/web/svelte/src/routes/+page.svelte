<script lang="ts">
	import { buttonVariants } from "../lib/components/ui/button";



</script>

<div class="flex justify-between items-center">
    <img src="/Lens_white_Logo.png" alt="Lenscorp" width={100} height={100} />
<a class={buttonVariants({ variant: "outline" })} href="/login">Login</a>

</div>
  <div class="relative flex h-[700px] w-full flex-col items-center justify-center overflow-hidden">
    <span class="pointer-events-none whitespace-pre-wrap bg-gradient-to-b from-black to-gray-300/80 bg-clip-text text-center text-8xl font-semibold leading-none text-transparent dark:from-white dark:to-slate-900/10">
      Lenscorp
    </span>
    <span class="pointer-events-none whitespace-pre-wrap bg-gradient-to-b from-black to-gray-300/80 bg-clip-text text-center text-7xl font-semibold leading-none text-transparent dark:from-white dark:to-slate-900/10">
      Enterprise Starter Kit
    </span>
  
    <div class="flex flex-col gap-8 mt-12 row-start-2 items-center sm:items-start">
      <div class="flex items-center gap-8">
        <img
          class="dark"
          src="/download.svg"
          alt="Next.js logo"
          width={180}
          height={38}
        />
        <span class="text-2xl font-bold">+</span>
        <img
          class="dark"
          src="/logo-small-gradient.svg"
          alt="Nest.js logo"
          width={180}
          height={38}
        />
      </div>
  
      <ol class="list-inside list-decimal text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
        <li class="mb-2">
          Get started by editing
          <code class="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-semibold">
            src/routes/+page.svelte
          </code>
          .
        </li>
      </ol>
    </div>
  </div>