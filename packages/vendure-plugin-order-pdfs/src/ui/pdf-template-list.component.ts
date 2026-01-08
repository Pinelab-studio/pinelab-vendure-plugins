import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
} from '@angular/core';
import {
  ConfigArgDefinition,
  getServerLocation,
  LocalStorageService,
  NotificationService,
  SharedModule,
  TypedBaseListComponent,
} from '@vendure/admin-ui/core';
import { TypedDocumentNode } from '@apollo/client';
import {
  createPDFTemplate,
  deletePDFTemplate,
  getPDFTemplates,
  updatePDFTemplate,
} from './queries.graphql';
import {
  CreatePdfTemplateMutation,
  CreatePdfTemplateMutationVariables,
  DeletePdfTemplateMutation,
  DeletePdfTemplateMutationVariables,
  PdfTemplate,
  PdfTemplateList,
  UpdatePdfTemplateMutation,
  UpdatePdfTemplateMutationVariables,
} from './generated/graphql';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { defaultTemplate } from './default-template';
import { downloadBlob, getHeaders } from './helpers';

const GetPDFTemplatesDocument: TypedDocumentNode<{
  pdfTemplates: PdfTemplateList;
}> = getPDFTemplates;

@Component({
  selector: 'pl-pdf-template-list-component',
  templateUrl: './pdf-template-list.component.html',
  standalone: true,
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .modal-footer.pdf-template {
        display: block;
      }
    `,
  ],
})
export class PDFTemplateListComponent extends TypedBaseListComponent<
  typeof GetPDFTemplatesDocument,
  'pdfTemplates'
> {
  showModal = false;
  modalAction: 'Edit' | 'Create' = 'Create';
  previewLoading = false;
  serverPath: string;
  htmlFormInputConfigArgsDef: ConfigArgDefinition = {
    name: 'templateString',
    type: 'text',
    list: false,
    required: false,
    ui: { component: 'html-editor-form-input' },
  };
  form: FormGroup;
  // This is needed to re-render the html form input after the value has been set
  renderHtmlFormInput = false;

  constructor(
    private changeDetector: ChangeDetectorRef,
    private formBuilder: FormBuilder,
    private notificationService: NotificationService,
    private localStorageService: LocalStorageService
  ) {
    super();
    super.configure({
      document: GetPDFTemplatesDocument,
      getItems: (data) => data.pdfTemplates,
      refreshListOnChanges: [],
    });
    this.serverPath = getServerLocation();
    this.form = this.formBuilder.group({
      id: [''],
      name: ['', Validators.required],
      enabled: [true, Validators.required],
      public: [false, Validators.required],
      templateString: ['', Validators.required],
    });
  }

  create() {
    this.modalAction = 'Create';
    this.clear();
    this.form.patchValue({
      id: '',
      name: '',
      enabled: true,
      public: false,
      templateString: defaultTemplate,
    });
    this.forceRerender();
    this.showModal = true;
  }

  edit(template: PdfTemplate) {
    this.modalAction = 'Edit';
    this.form.patchValue({
      id: template.id,
      name: template.name,
      enabled: template.enabled,
      public: template.public,
      templateString: template.templateString,
    });
    this.forceRerender();
    this.showModal = true;
  }

  /**
   * Super gross function to destroy and recreate the html-editor-form input,
   * because it doesn't allow updating value after rendering
   */
  forceRerender(): void {
    this.renderHtmlFormInput = false;
    this.changeDetector.detectChanges();
    setTimeout(() => {
      this.renderHtmlFormInput = true;
      this.changeDetector.detectChanges();
    }, 1);
  }

  delete() {
    this.dataService
      .mutate<DeletePdfTemplateMutation, DeletePdfTemplateMutationVariables>(
        deletePDFTemplate,
        {
          id: this.form.get('id')!.value,
        }
      )
      .subscribe((s: any) => {
        this.showModal = false;
        this.clear();
        this.notificationService.success('Deleted');
        super.refresh();
      });
  }

  clear() {
    this.form.patchValue({
      id: '',
      name: '',
      enabled: true,
      public: true,
      templateString: '',
    });
  }

  createOrUpdate() {
    const formValues = this.form.value;
    console.log(formValues);
    if (formValues.id) {
      // Update
      this.dataService
        .mutate<UpdatePdfTemplateMutation, UpdatePdfTemplateMutationVariables>(
          updatePDFTemplate,
          {
            id: formValues.id,
            input: {
              enabled: formValues.enabled,
              public: formValues.public,
              name: formValues.name,
              templateString: formValues.templateString,
            },
          }
        )
        .subscribe((s: any) => {
          this.showModal = false;
          this.clear();
          this.notificationService.success('Saved');
          this.changeDetector.detectChanges();
        });
    } else {
      // Create new
      this.dataService
        .mutate<CreatePdfTemplateMutation, CreatePdfTemplateMutationVariables>(
          createPDFTemplate,
          {
            input: {
              name: formValues.name,
              enabled: formValues.enabled,
              public: formValues.public,
              templateString: formValues.templateString,
            },
          }
        )
        .subscribe((s: any) => {
          this.showModal = false;
          this.clear();
          this.notificationService.success('Created');
          this.changeDetector.detectChanges();
          super.refresh();
        });
    }
  }

  async preview() {
    const formValues = this.form.value;
    try {
      this.previewLoading = true;
      const res = await fetch(`${this.serverPath}/order-pdf/preview/`, {
        headers: getHeaders(this.localStorageService),
        method: 'POST',
        body: JSON.stringify({
          template: formValues.templateString,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw Error(json?.message);
      }
      const blob = await res.blob();
      const fileName =
        formValues.name?.toLowerCase().replace(' ', '_') + '_preview.pdf';
      await downloadBlob(blob, fileName);
    } catch (err: any) {
      console.error(err);
      this.notificationService.error(err?.message);
    } finally {
      this.previewLoading = false;
    }
  }
}
