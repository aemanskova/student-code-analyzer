import { withAuth } from "@app/providers/Auth/withAuth"
import { withStyles } from "@app/providers/Mantine"
import { withReduxToolkit } from "@app/providers/ReduxToolkit"
import { compose } from "@shared/lib"

export const withProviders = compose(withStyles, withReduxToolkit, withAuth)
