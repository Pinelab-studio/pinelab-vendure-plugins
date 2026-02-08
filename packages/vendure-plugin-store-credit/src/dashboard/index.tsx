import { Button, defineDashboardExtension } from '@vendure/dashboard';

defineDashboardExtension({
  login: {
    afterForm: {
      component: () => (
        <div>
          <Button variant="secondary" className="w-full">
            Login with Vendure ID
          </Button>
        </div>
      ),
    },
  },
});
