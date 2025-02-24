<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	const frameworks = [
		{
			value: 'sveltekit',
			label: 'SvelteKit'
		},
		{
			value: 'next',
			label: 'Next.js'
		},
		{
			value: 'astro',
			label: 'Astro'
		},
		{
			value: 'nuxt',
			label: 'Nuxt.js'
		}
	];
</script>

<div class="flex justify-center items-center h-screen">
    <Card.Root class="w-[350px]">
        <Card.Header>
            <Card.Title>Login</Card.Title>
            <Card.Description>Enter your email and password to login to your account</Card.Description>
        </Card.Header>
        <Card.Content>
            <form>
                <div class="grid w-full items-center gap-4">
                    <div class="flex flex-col space-y-1.5">
                        <Label for="email">Email</Label>
                        <Input id="email" type="email" placeholder="Email" />
                    </div>
                    <div class="flex flex-col space-y-1.5">
                        <Label for="password">Password</Label>
                        <Input id="password" type="password" placeholder="Password" />
                    </div>
                </div>
            </form>
        </Card.Content>
        <Card.Footer class="flex justify-between">
            <Button>Login</Button>
        </Card.Footer>
    </Card.Root>
</div>


